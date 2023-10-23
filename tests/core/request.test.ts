import { describe, expect, it } from 'vitest'
import { InitAppAndTest } from '../../test_helpers/initAppAndTest'
import { App } from '../../packages/app/src/app'
import { makeFetch } from 'supertest-fetch'
import { Agent } from 'node:http'
import { getProtocol, getSubdomains } from '../../packages/app/src'

describe('Request properties', () => {
  it('should have default HTTP Request properties', async () => {
    const { fetch } = InitAppAndTest((req, res) => {
      res.status(200).json({
        url: req.url,
        headersSent: res.headersSent
      })
    })

    await fetch('/').expect(200, { url: '/', headersSent: false })
  })

  describe('URL extensions', () => {
    it('req.query is being parsed properly', async () => {
      const { fetch } = InitAppAndTest((req, res) => void res.send(req.query))

      await fetch('/?param1=val1&param2=val2').expect(200, {
        param1: 'val1',
        param2: 'val2'
      })
    })
    it('req.params is being parsed properly', async () => {
      const { fetch } = InitAppAndTest((req, res) => void res.send(req.params), '/:param1/:param2')

      await fetch('/val1/val2').expect(200, {
        param1: 'val1',
        param2: 'val2'
      })
    })
    it('req.url does not include the mount path', async () => {
      const app = new App()

      app.use('/abc', (req, res) => res.send(req.url))

      const server = app.listen()

      const fetch = makeFetch(server)

      await fetch('/abc/def').expect(200, '/def')
    })
  })

  describe('Network extensions', () => {
    const ipHandler = (req, res) => {
      res.json({
        ip: req.ip,
        ips: req.ips
      })
    }
    const options = {
      settings: {
        networkExtensions: true
      }
    }
    it('IPv4 req.ip & req.ips is being parsed properly', async () => {
      const { fetch } = InitAppAndTest(ipHandler, '/', 'GET', options)

      const agent = new Agent({ family: 4 }) // ensure IPv4 only
      await fetch('/', { agent }).expect(200, {
        ip: '127.0.0.1',
        ips: ['::ffff:127.0.0.1']
      })
    })
    if (process.env.GITHUB_ACTION) {
      // skip ipv6 tests only for github ci/cd
      it('IPv6 req.ip & req.ips is being parsed properly', async () => {
        const { fetch } = InitAppAndTest(ipHandler, '/', 'GET', options)

        const agent = new Agent({ family: 6 }) // ensure IPv6 only
        await fetch('/', { agent }).expect(200, {
          ip: '1',
          ips: ['::1']
        })
      })
    }
    it('req.protocol is http by default', async () => {
      const { fetch } = InitAppAndTest(
        (req, res) => {
          res.send(`protocol: ${req.protocol}`)
        },
        '/',
        'GET',
        options
      )

      await fetch('/').expect(200, `protocol: http`)
    })
    it('req.secure is false by default', async () => {
      const { fetch } = InitAppAndTest(
        (req, res) => {
          res.send(`secure: ${req.secure}`)
        },
        '/',
        'GET',
        options
      )

      await fetch('/').expect(200, `secure: false`)
    })
    it('req.subdomains is empty by default', async () => {
      const { fetch } = InitAppAndTest(
        (req, res) => {
          res.send(`subdomains: ${req.subdomains?.join(', ')}`)
        },
        '/',
        'GET',
        options
      )

      await fetch('/').expect(200, `subdomains: `)
    })
    describe('internal function tests', () => {
      it('should test getSubdomains when host is null', async () => {
        const app = new App()
        app.get('/', (req, res) => {
          req.headers.host = undefined
          res.send(getSubdomains(req))
        })
        await makeFetch(app.listen())('/').expectStatus(200)
      })
      it('should test getSubdomains when host is an IP', async () => {
        const app = new App()
        app.get('/', (req, res) => {
          req.headers.host = '127.0.0.1'
          res.send(getSubdomains(req))
        })
        await makeFetch(app.listen())('/').expectStatus(200)
      })
      it('should test getSubdomains when host is an array', async () => {
        const app = new App()
        app.get('/', (req, res) => {
          req.headers.host = '[127.0.0.1]'
          res.send(getSubdomains(req))
        })
        await makeFetch(app.listen())('/').expectStatus(200)
      })
      it('should test getProtocol', async () => {
        const app = new App()
        app.get('/', (req, res) => {
          req.secure = true
          return res.send(getProtocol(req))
        })
        await makeFetch(app.listen())('/', { headers: { 'X-Forwarded-Proto': 'https, http' } }).expectStatus(200)
      })
      it('should use a default value if socket is destroyed', async () => {
        const app = new App()
        app.get('/', (req, res) => {
          req.socket.destroy()
          return res.send(getProtocol(req))
        })
        try {
          await makeFetch(app.listen())('/')
        } catch (error) {
          expect(error).toBeDefined()
        }
      })
    })
  })

  it('req.xhr is false because of node-superagent', async () => {
    const { fetch } = InitAppAndTest((req, res) => {
      res.send(`XMLHttpRequest: ${req.xhr ? 'yes' : 'no'}`)
    })

    await fetch('/').expect(200, `XMLHttpRequest: no`)
  })

  it('req.path is the URL but without query parameters', async () => {
    const { fetch } = InitAppAndTest((req, res) => {
      res.send(`Path to page: ${req.path}`)
    })

    await fetch('/page?a=b').expect(200, `Path to page: /page`)
  })
  it('req.path works properly for optional parameters', async () => {
    const { fetch } = InitAppAndTest((req, res) => {
      res.send(`Path to page: ${req.path}`)
    }, '/:format?/:uml?')

    await fetch('/page/page-1').expect(200, `Path to page: /page/page-1`)
  })
  it('req.fresh and req.stale get set', async () => {
    const etag = '123'
    const { fetch } = InitAppAndTest(
      (_req, res) => {
        res.set('ETag', etag).send('stale')
      },
      '/',
      'GET'
    )

    await fetch('/', { headers: { 'If-None-Match': etag } }).expectStatus(304)
  })
})
