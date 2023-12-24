import puppeteer from "puppeteer";
import { footerTemplate, headerTemplate } from "./header-footer-template.mjs";
import mergePDF from "./merge-pdf.mjs";
import { writeFileSync } from 'fs'

/**
 * 生成 PDF 文件
 */
async function generatePDF() {
  // 启动浏览器。为了演示效果，暂时关闭无头模式，以浏览器界面形式运行
  const browser = await puppeteer.launch({ headless: false, devtools: true })
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

  /**
   * 目录页
   *    这里为了展示核心逻辑，前端代码尽可能简洁，不影响主逻辑的理解
   */
  // 目录配置，通过 page.evaluate 方法的第二个参数传递会回调函数
  const dirConfig = [
    { title: '热点新闻', id: 'focus-top' },
    { title: '北京新闻', id: "local_news" },
    { title: '视野', id: "guonei" },
    { title: '天下', id: 'guojie' },
    { title: '体育', id: 'tiyu' },
    { title: '财经', id: 'caijing' },
    { title: '科技', id: 'col-tech' },
    { title: '军事', id: 'junshi' },
    { title: '互联网', id: 'hulianwang' },
    { title: '搜索', id: 'col-discovery' },
    { title: '健康', id: 'col-healthy' },
    { title: '图片新闻', id: 'tupianxinwen' },
  ]
  // 通过 DOM 操作为新闻页添加 目录 DOM
  await page.evaluate(function (dirConfig) {
    /**
     * 目录页样式
     */
    const styleStr = `
      .dirEl {
        break-after: page;
      }

      .pageTitleDiv {
        text-align: center;
        margin-bottom: 60px;
      }

      .dirItemWrapper {
        display: flex;
        justify-content: space-around;
        align-items: center;
        margin-bottom: 10px;
      }

      .dirItemWrapper__sepratorDiv {
        margin: 0 4px;
        border-bottom: 4px dotted #666;
        flex-grow: 1;
      }
    `
    const styleEl = document.createElement('style')
    styleEl.appendChild(document.createTextNode(styleStr))

    /**
     * 页面标题 —— 目录
     */
    const pageTitleDiv = document.createElement('h1')
    pageTitleDiv.appendChild(document.createTextNode('目录'))
    pageTitleDiv.classList.add('pageTitleDiv')

    /**
     * 目录项
     */
    const fragement = document.createDocumentFragment()
    for (let i = 0, len = dirConfig.length; i < len; i++) {
      const { title, id } = dirConfig[i]

      const dirItemWrapper = document.createElement('div')
      dirItemWrapper.classList.add('dirItemWrapper')
      // 带序号的标题 —— a 标签
      const titleA = document.createElement('a')
      titleA.appendChild(document.createTextNode(`${i + 1}、${title}`))
      titleA.setAttribute('href', `#${id}`)
      // 标题 和 页码之间的分割符号 —— .........
      const sepratorDiv = document.createElement('div')
      sepratorDiv.classList.add('dirItemWrapper__sepratorDiv')
      // 页码
      const pageNumSpan = document.createElement('span')
      pageNumSpan.appendChild(document.createTextNode('页码'))

      // 将三个子元素添加到父元素内
      dirItemWrapper.appendChild(titleA)
      dirItemWrapper.appendChild(sepratorDiv)
      dirItemWrapper.appendChild(pageNumSpan)

      // 目录项添加到 fragment 片段中
      fragement.appendChild(dirItemWrapper)
    }

    // 汇总目录页的元素
    const dirEl = document.createElement('div')
    dirEl.classList.add('dirEl')
    dirEl.appendChild(styleEl)
    dirEl.appendChild(pageTitleDiv)
    dirEl.appendChild(fragement)

    // 将目录页 DOM 添加到新闻页 DOM 的最前面
    document.body.insertBefore(dirEl, document.body.firstChild)
  }, dirConfig)

  // 将当前页打印成 PDF 文件。不设置 path，文件将会保存在内存中
  const contentBuffer = await page.pdf({
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
  const coverBuffer = await page.pdf({
    format: 'A4',
    printBackground: true
  })
  // 尾页
  await page.goto('file:///Users/liyongning/studyspace/generate-pdf/fe/last-page.html')
  const lastPageBuffer = await page.pdf({
    format: 'A4',
    printBackground: true
  })
  // 合并三份 PDF
  const pdfBuffer = await mergePDF(coverBuffer, contentBuffer, lastPageBuffer)
  // 将合并后的终版 PDF 文件写盘
  writeFileSync('./final.pdf', pdfBuffer)
  // 关闭浏览器
  await browser.close()
}

generatePDF()