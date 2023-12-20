import { WebContainer } from '@webcontainer/api'
import stripAnsi from 'strip-ansi'

// Singleton on port 1880
// Accessible from the page itself only
let webcontainerInstance
let initRan = false
const port = 1880

const output = document.querySelector('#output')

const OutputStreamPrototype = {
  write(data) {
    console.log(stripAnsi(data))
  }
}

const files = {
  'index.js': {
    file: {
      contents: `
        import http from 'http'
        import express from 'express'
        import RED from 'node-red'
        import { runYosys } from '@yowasp/yosys'

        const app = express()
        app.use('/', express.static('public'))

        const server = http.createServer(app)

        const settings = {
          httpAdminRoot: '/red',
          httpNodeRoot: '/',
          userDir: '.',
          flowFile: 'flows.json',
          functionGlobalContext: {
            runYosys: function (cmd, msg, node) {
              const result = []

              runYosys([ cmd ], [], {
                  printLine: line => result.push(line),
                  decodeASCII: true
              }).then(function(){
                  msg.payload = result
                  node.send(msg)
              })
            }
          }
        }

        RED.init(server, settings)
        app.use(settings.httpAdminRoot, RED.httpAdmin)
        app.use(settings.httpNodeRoot, RED.httpNode)

        server.listen(${port})

        RED.start()
      `,
    },
  },
  'package.json': {
    file: {
      contents: `{
        "name": "webcontainer-bonus",
        "type": "module",
        "dependencies": {
          "express": "latest",
          "node-red": "latest",
          "node-red-node-swagger": "latest",
          "node-red-debugger": "latest",
          "nodemon": "latest",
          "@yowasp/yosys": "latest"
        },
        "scripts": {
          "start": "nodemon index.js"
        }
      }`,
    },
  },
  'flows.json': {
    file: {
      contents: `[{"id":"79f2ac62b7d3a52b","type":"tab","label":"Yosys","disabled":false,"info":"","env":[]},{"id":"d581b155863d86e3","type":"swagger-doc","summary":"","description":"","tags":"yosys","consumes":"","produces":"","parameters":[{"name":"cmd","in":"query","required":true,"type":"string"}],"responses":{"200":{"description":""}},"deprecated":false},{"id":"40795e8e67c44acf","type":"http in","z":"79f2ac62b7d3a52b","name":"","url":"/yosys","method":"get","upload":false,"swaggerDoc":"d581b155863d86e3","x":90,"y":60,"wires":[["9a21494c5a4ba30c"]]},{"id":"760999de666eab31","type":"http response","z":"79f2ac62b7d3a52b","name":"👍","statusCode":"","headers":{},"x":310,"y":180,"wires":[]},{"id":"9a21494c5a4ba30c","type":"function","z":"79f2ac62b7d3a52b","name":"yosys","func":"global.get('runYosys')(msg.req.query.cmd, msg, node)","outputs":1,"timeout":0,"noerr":0,"initialize":"","finalize":"","libs":[],"x":210,"y":120,"wires":[["760999de666eab31"]]}]`
    }
  },
}

async function initWebcontainer() {
  // Call only once
  webcontainerInstance = await WebContainer.boot()

  await webcontainerInstance.mount(files)
}

async function npm(cmd) {
  const process = await webcontainerInstance.spawn('npm', cmd)
  const stdout = new WritableStream(OutputStreamPrototype)

  // Capture output
  process.output.pipeTo(stdout)

  // Wait for process to exit
  return process.exit
}

window.addEventListener('load', async () => {
  await initWebcontainer()
  webcontainerInstance.on('server-ready', (port, url) => {
    // Ugly hack to avoid hitting the server before it is ready
    if (!initRan) {
      setTimeout(() => { output.src = `${url}/red` }, 2000)
      initRan = true
    }
  })

  if (await npm(['install']) !== 0) throw new Error('Installation failed')
  if (await npm(['run', 'start']) !== 0) throw new Error('Start failed')
})