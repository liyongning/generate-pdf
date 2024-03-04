import Koa from 'koa'
import KoaRouter from '@koa/router'
import { generatePDF } from './index.mjs'
import axios from 'axios'

const app = new Koa()
const router = new KoaRouter()

// 当用户请求 http://localhost:3000 时，触发 generatePDF() 函数生成 PDF 文件
router.get('/', async function (ctx) {
  const appId = ctx.query.appId
  const { data: configData } = await axios.get(`http://localhost:3000/get-pdf-config?appId=${appId}`)
  // 异常情况
  if (configData.errno) {
    ctx.body = configData
    return
  }

  const { data } = configData
  generatePDF(data)

  ctx.body = {
    errno: 0,
    data: [],
    msg: '正在生成 PDF 文件'
  }
})

// 获取指定 appId 所对应的配置信息
router.get('/get-pdf-config', function (ctx) {
  const pdfConfig = {
    // 为接入方分配唯一的 uuid
    '59edaf80-ca75-8699-7ca7-b8121d01d136': {
      name: 'PDF 生成服务测试',
      // 目录页配置
      dir: [
        { title: '锚点 1', id: 'anchor1' },
        { title: '锚点 2', id: 'anchor2' },
        { title: '第二个内容页 —— 锚点 1', id: 'second-content-page-anchor1' },
        { title: '第二个内容页 —— 锚点 2', id: 'second-content-page-anchor2' },
      ],
      // 接入方的前端页面链接
      pageInfo: {
        // 封面
        "cover": "file:///Users/liyongning/studyspace/generate-pdf/fe/cover.html",
        // 内容页
        "content": [
          "file:///Users/liyongning/studyspace/generate-pdf/fe/exact-page-num.html",
          "file:///Users/liyongning/studyspace/generate-pdf/fe/second-content-page.html"
        ],
        // 尾页
        "lastPage": "file:///Users/liyongning/studyspace/generate-pdf/fe/last-page.html"
      },
      // ... 还可以增加其他配置
    }
  }

  const appId = ctx.query.appId || ''
  if (!pdfConfig[appId]) {
    ctx.body = {
      errno: 100,
      data: [],
      msg: '无效的 appId，请联系服务提供方申请接入'
    }
    return
  }

  ctx.body = {
    errno: 0,
    data: pdfConfig[appId],
    msg: 'success'
  }
})

app.use(router.routes())

app.listen(3000, () => {
  console.log('koa-server start at 3000 port')
})