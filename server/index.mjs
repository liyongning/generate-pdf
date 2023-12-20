import puppeteer from "puppeteer";
import { footerTemplate, headerTemplate } from "./header-footer-template.mjs";

/**
 * 生成 PDF 文件
 */
async function generatePDF() {
  // 启动浏览器。为了演示效果，暂时关闭无头模式，以浏览器界面形式运行
  const browser = await puppeteer.launch({ headless: false })
  // 打开一个新的 Tab 页
  const page = await browser.newPage()
  // 在当前 Tab 页上打开 “百度新闻” 页。第二个配置参数，意思是当页面触发 load 事件，并且 500ms 内没有新的网络连接，则继续往下执行
  await page.goto('https://news.baidu.com', { waitUntil: ['load', 'networkidle0'] })
  // 滚动页面，加载完整内容。evaluate 的回调函数会在浏览器中执行，evalaute 方法的返回值是回调函数的返回值
  await page.evaluate(function () {
    return new Promise(resolve => {
      // 通过递归来滚动页面
      function scrollPage() {
        // { 浏览器窗口可视区域的高度，页面的总高度，已滚动的高度 }
        const { clientHeight, scrollHeight, scrollTop } = document.documentElement
        // 如果滚动高度 + 视口高度 < 总高度，则继续滚动，否则就任务滚动到底部了
        if (scrollTop + clientHeight < scrollHeight) {
          document.documentElement.scrollTo(0, scrollTop + clientHeight)
          // 加一个 setTimeout 来保证滚动的稳定性
          setTimeout(() => {
            scrollPage()
          }, 500)
        } else {
          resolve()
        }
      }
      scrollPage()
    })
  })
  // 将当前页打印成 PDF 文件
  await page.pdf({
    // PDF 文件的存储路径，如果不设置则会以二进制的形式放到内存中
    path: './news.pdf',
    // 以 A4 纸的尺寸来打印 PDF
    format: 'A4',
    // 设置 PDF 文件的页边距，避免内容完全贴边
    margin: {
      top: 40,
      right: 40,
      bottom: 40,
      left: 40
    },
    // 开启页眉、页脚
    displayHeaderFooter: true,
    // 通过 HTML 模版字符串自定义页眉、页脚
    headerTemplate: headerTemplate(),
    footerTemplate: footerTemplate(),
    // 打印的时候打印背景色
    printBackground: true,
  })
  // 封面
  await page.goto('file:///Users/liyongning/studyspace/generate-pdf/fe/cover.html')
  await page.pdf({
    path: './cover.pdf',
    format: 'A4',
    printBackground: true
  })
  // 尾页
  await page.goto('file:///Users/liyongning/studyspace/generate-pdf/fe/last-page.html')
  await page.pdf({
    path: './last-page.pdf',
    format: 'A4',
    printBackground: true
  })
  // 关闭浏览器
  await browser.close()
}

generatePDF()