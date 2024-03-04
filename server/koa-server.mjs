import Koa from 'koa'
import KoaRouter from '@koa/router'
import { generatePDF } from './index.mjs'

const app = new Koa()
const router = new KoaRouter()

// 当用户请求 http://localhost:3000 时，触发 generatePDF() 函数生成 PDF 文件
router.get('/', function (ctx) {
  generatePDF()

  ctx.body = {
    errno: 0,
    data: [],
    msg: '正在生成 PDF 文件'
  }
})

app.use(router.routes())

app.listen(3000, () => {
  console.log('koa-server start at 3000 port')
})