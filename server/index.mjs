import puppeteer from "puppeteer";

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
    // 打印的时候打印背景色
    printBackground: true,
  })
  // 关闭浏览器
  await browser.close()
}

generatePDF()