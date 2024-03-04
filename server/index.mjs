import puppeteer from "puppeteer";
import { footerTemplate, headerTemplate } from "./header-footer-template.mjs";
import mergePDF from "./merge-pdf.mjs";
import { writeFileSync } from 'fs'
import crypto from 'crypto'

/**
 * 延时函数
 * @param { number } milliseconds 毫秒数
 * @returns Promise<number>
 */
function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/**
 * 生成 PDF 文件
 */
export async function generatePDF() {
  // 启动浏览器。为了演示效果，暂时关闭无头模式，以浏览器界面形式运行
  const browser = await puppeteer.launch({ headless: false, devtools: true })
  // 打开一个新的 Tab 页
  const page = await browser.newPage()
  // 让当前 Tab 页始终处于前台
  await page.bringToFront()
  // 页面缩放比例
  const scale = 1123 / 1684
  // 内容页 URL 列表
  const contentPages = ['file:///Users/liyongning/studyspace/generate-pdf/fe/exact-page-num.html', 'file:///Users/liyongning/studyspace/generate-pdf/fe/second-content-page.html']
  // 保存每个内容页的 HTML 字符串，每个元素格式为 { cssPrefix: 'sandbox-uuid', content: 'html字符串' }
  const pdfContentPages = []
  // 遍历内容页列表，分别打开这些页面，并获取页面的 HTML 文档
  for (let i = 0; i < contentPages.length; i++) {
    // 打开内容页
    await page.goto(contentPages[i], { waitUntil: ['load', 'networkidle0'] })
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
            // 滚动回顶部，不然计算目录项的页码会有问题
            document.documentElement.scrollTo(0, 0)
            resolve()
          }
        }
        scrollPage()
      })
    })

    // 延时 2s，防止页面没有完整渲染，比如 canvas，如果没有足够的渲染时间会发现可能只渲染了部分
    await delay(2000)

    // 获取当前页面的 HTML 文档（纯静态的 HTML 字符串）
    const htmlStr = await page.evaluate(function () {
      /**
       * 获取当前页面的 HTML 文档，当然文档是经过特殊处理的
       *    1. 移除文档中的所有 JS 标签。因为这里希望拿到的 HTML 文档是纯静态的，当这段 HTML 被再次添加到 DOM 树中不希望 HTML 中的内容再次发生变化
       *    2. 将 canvas 绘制的内容转换为图片，然后通过 img 加载并替换当前 canvas 标签。因为 canvas 画布上的内容是通过 JS 绘制上去的，复制后的 HTML 文档中不包含 JS，会发现 canvas 画布是空白的
       *    3. 补全 HTML 文档中的 URL 地址，将所有的相对地址变成绝对地址
       *
       * 注意：这里不能应用常规的性能优化策略，比如将整个文档克隆一份，然后操作克隆出来的文档，这时候会发现 canvas 转成的图片没法正常渲染
       *
       * @returns 当前页面的 HTML 字符串，document.documentElement.innerHTML
       */
      function getuCurrentPageHtml() {
        // 移除所有 JS，因为不希望这部分 HTML 添加到内容页的 DOM 树上后，数据再次发生变化
        const allScriptEl = document.querySelectorAll('script')
        const allLinkJS = document.querySelectorAll('link[as="script"]');
        [...allScriptEl, ...allLinkJS].forEach(scriptEl => {
          scriptEl.parentNode?.removeChild(scriptEl)
        })

        // 处理 canvas，canvas 直接复制只能复制一个空画布，需要将 canvas 转换成图片
        const allCanvasEl = document.querySelectorAll('canvas')
        allCanvasEl.forEach(canvasEl => {
          const image = new Image()
          // 图片的尺寸是 canvas 实际的物理像素
          image.width = canvasEl.offsetWidth
          image.height = canvasEl.offsetHeight
          image.src = canvasEl.toDataURL()
          canvasEl.parentNode?.appendChild(image)
          canvasEl.parentNode?.removeChild(canvasEl)
        })

        // 补全 HTML 片段中的 URL 地址，将所有的相对地址变成绝对地址
        const hrefEls = document.querySelectorAll('[href]')
        hrefEls.forEach((el) => {
          // <link rel="stylesheet" href="/test/style.css" />，但在浏览器中通过 DOM 操作，获取到的 el.href 是绝对地址，用绝对地址覆盖现有的标签属性
          el.href = el.href
        })
        const srcEls = document.querySelectorAll('[src]');
        srcEls.forEach((el) => {
          // 不处理 Data URL
          if (!el.src.startsWith('data:')) {
            el.src = el.src
          }
        })

        return document.documentElement.innerHTML
      }
      return getuCurrentPageHtml()
    })

    pdfContentPages.push({ cssPrefix: `sandbox-${crypto.randomUUID()}`, content: htmlStr })
  }

  // 打开 PDF 内容页的容器页面，页面会负责承载上一步获取到的所有 HTML 文档，然后将这个容器页面生成 PDF
  await page.goto('file:///Users/liyongning/studyspace/generate-pdf/fe/pdf-content.html', { waitUntil: ['load', 'networkidle0'] })

  // 用上面拿到的 HTML 内容填充当前打开的容器页面
  await page.evaluate((pdfContentPagesStr) => {
    return new Promise(resolve => {
      /**
       * 生成 PDF 内容页
       * @param { Array<{ cssPrefix: string; content: string HTML 字符串; }> } pdfContentPages 
       */
      function generatePdfContent(pdfContentPages) {
        return new Promise(resolve => {
          const promiseArr = []

          for (let i = 0, len = pdfContentPages.length; i < len; i++) {
            const { cssPrefix, content } = pdfContentPages[i]
            const wrapper = document.createElement('div')
            wrapper.setAttribute('id', cssPrefix)
            wrapper.setAttribute('css-prefix', cssPrefix)
            wrapper.innerHTML = content
            /**
             * 这里不能用 fragment 去尝试优化。如果用了 fragment 会导致样式沙箱出问题，因为未进入 DOM 树的 style 节点无法获取 styleEl.sheet 属性（值为 null)
             */
            document.body.appendChild(wrapper)

            // 获取所有引入外部样式表的 link 标签
            const allLinkEl = Array.from(wrapper.querySelectorAll('link')).filter(linkEl => linkEl.getAttribute('rel') === 'stylesheet')

            const loadLinkPromise = []

            // 将外部引入的样式表全部换成 style 标签
            const allLinkElLen = allLinkEl.length
            if (allLinkElLen > 0) {
              for (let j = 0; j < allLinkElLen; j++) {
                const linkEl = allLinkEl[j]
                const href = linkEl.getAttribute('href')
                const ret = fetch(href).then(res => res.text()).then(res => {
                  const styleEl = document.createElement('style')
                  styleEl.textContent = res
                  wrapper.insertBefore(styleEl, linkEl)
                  wrapper.removeChild(linkEl)
                })
                loadLinkPromise.push(ret)
              }
            }

            // warpper 下的所有 link 标签替换为 style 标签之后，设置样式沙箱
            promiseArr.push(Promise.all(loadLinkPromise).then(() => editStyle(wrapper, cssPrefix)))
          }

          Promise.all(promiseArr).then(() => resolve())
        })

        /**
         * 处理指定节点下的所有 style 节点，为节点内的样式规则增加命名空间
         * @param { Element } rootNode
         */
        function editStyle(rootNode, cssPrefix) {
          const allStyleEl = rootNode.querySelectorAll('style')
          allStyleEl.forEach(styleEl => {
            const rules = [...styleEl.sheet?.cssRules || []]
            const cssText = rewrite(rules, `#${cssPrefix}`)
            styleEl.textContent = cssText
          })
        }

        function rewrite(rules, prefix) {
          let cssText = ''
          rules.forEach(rule => {
            switch (rule.type) {
              case 1:
                // style
                cssText += ruleStyle(rule, prefix)
                break;
              case 4:
                cssText += ruleMedia(rule, prefix)
                break;
              case 12:
                cssText += ruleSupport(rule, prefix)
                break;
              default:
                if (typeof rule.cssText === 'string') {
                  cssText += `${rule.cssText}`
                }
                break;
            }
          })
          return cssText
        }

        /**
         * 处理 CSSStyleRule 样式规则，为这些样式的选择器添加前缀(命名空间)
         * @param { CSSStyleRule } rule 就是一个 CSS 样式，比如 .content { xxx }
         * @param { string } prefix 前缀选择器
         * @returns cssText
         */
        function ruleStyle(rule, prefix) {
          // 选择器
          const selector = rule.selectorText.trim();

          // CSS 样式代码
          let cssText = '';
          if (typeof rule.cssText === 'string') {
            cssText = rule.cssText;
          }

          /**
           * 匹配以 body、html 或 :root 打头的选择器
           *    这里用到了非捕获分组来剔除 xxbody、xxhtml、xx:root 的情况，
           *    比如 字母数字下划线body、-body、.body、#body 等情况，只匹配以 body、html、:root 这三个选择器开头的情况
           */
          const rootSelectorRE = /((?:[^\w\-.#]|^)(body|html|:root))/gm;

          // 处理 html {}、body {}、:root {} 情况，将根选择器变成 .prefix {}
          if (selector === 'html' || selector === 'body' || selector === ':root') {
            return cssText.replace(rootSelectorRE, prefix);
          }

          /**
           * 利用 分组 来捕获 htmlxx，即以 html 打头的选择器，但 html 后面的字母、数字、下划线、{、[、] 等字符都不被捕获，
           * 所以基本上只匹配以 html 打头的选择器（包含组合选择器），比如 html、html 、html >、html + 等字符
           */
          const rootCombinationRE = /(html[^\w{[]+)/gm;

          // 处理 html 打头的选择器
          if (rootCombinationRE.test(rule.selectorText)) {
            // 处理非 html + xx 或 html ~ xx 形式的组合选择器，但必须是 html 打头的，比如 html > .content，处理之后变成了 .content
            const siblingSelectorRE = /(html[^\w{]+)(\+|~)/gm;
            if (!siblingSelectorRE.test(rule.selectorText)) {
              cssText = cssText.replace(rootCombinationRE, '');
            }
          }

          /**
           * 处理非 html 打头的选择器
           * 1. 匹配 “任意字符 {”，即：选择器 {，但这里的任意字符不包括 html 选择器，这种情况上面已经处理完了
           * 2. 将上一步的 “任意字符 {” 中的 “任意字符” 匹配出来，可能是 "selcotor" 或 ", selector"，item 是选择器，p 和 s 分别是两个分组匹配出来的字符，所以 s 才是重点（选择器）
           * 3. 如果匹配到的选择器是以 body 或 :root 打头的，则将 前缀选择器 替换，否则直接在选择器前增加 前缀选择器
           */
          cssText = cssText.replace(/^[\s\S]+{/, (selectors) =>
            selectors.replace(/(^|,\n?)([^,]+)/g, (item, p, s) => {
              // 处理以 body 和 :root 打头的组合选择器，比如 body div {}
              if (rootSelectorRE.test(item)) {
                return item.replace(rootSelectorRE, (m) => {
                  // 有效字符白名单，这些字符不会丢失
                  const whitePrevChars = [',', '('];

                  // 如果前一个字符是逗号或左括号，则保留前一个字符
                  if (m && whitePrevChars.includes(m[0])) {
                    return `${m[0]}${prefix}`;
                  }

                  // 否则直接将 body 或 :root 替换为前缀选择器（命名空间）
                  return prefix;
                });
              }

              // 处理其他选择器，在选择器前添加前缀
              return `${p}${prefix} ${s.replace(/^ */, '')}`;
            }),
          );

          return cssText;
        }

        // handle case:
        // @media screen and (max-width: 300px) {}
        function ruleMedia(rule, prefix) {
          const css = rewrite([...rule.cssRules], prefix);
          return `@media ${rule.conditionText || rule.media.mediaText} {${css}}`;
        }

        // handle case:
        // @supports (display: grid) {}
        function ruleSupport(rule, prefix) {
          const css = rewrite([...rule.cssRules], prefix);
          return `@supports ${rule.conditionText || rule.cssText.split('{')[0]} {${css}}`;
        }
      }

      // 生成内容页
      const pdfContentPromise = generatePdfContent(JSON.parse(pdfContentPagesStr))

      /**
       * 这里加 5s 的延时，是因为重写 HTML 中可能有一些外部资源，比如 img 加载的图片，如果直接 resolve 的话，可能这些资源还未就绪（加载 和 完成渲染），所以延时。
       */
      pdfContentPromise.then(() => {
        setTimeout(() => {
          resolve(true)
        }, 5000)
      })
    })
  }, JSON.stringify(pdfContentPages))

  /**
   * 目录页
   *    这里为了展示核心逻辑，前端代码尽可能简洁，不影响主逻辑的理解
   */
  // 目录配置，通过 page.evaluate 方法的第二个参数传递会回调函数
  const dirConfig = [
    { title: '锚点 1', id: 'anchor1' },
    { title: '锚点 2', id: 'anchor2' },
    { title: '第二个内容页 —— 锚点 1', id: 'second-content-page-anchor1' },
    { title: '第二个内容页 —— 锚点 2', id: 'second-content-page-anchor2' },
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
    // 累计补充高度。用来补充因为 page-break: page 或 page-break-before: always 样式而出现的空白区域
    let cumulativeCompensationHeight = 0

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
      /**
       * 页码
       */
      const pageNumSpan = document.createElement('span')
      // 获取当前锚点元素 
      const anchorEl = document.querySelector(`#${id}`)
      // 得到锚点元素距离顶部的像素
      const { y } = anchorEl.getBoundingClientRect()
      /**
       * 假设 PDF 一页的像素高度是 1524px，从而计算出当前锚点在第几页
       *    为什么是 1524，而不是 1684 ？
       * 因为页面中的页眉、页脚是通过 puppeteer 直接生成的，没有通过前端开发，所以前端开发时，页面高度需要减去页眉、页脚的高度，即 1684 - 160 = 1524
       */
      // 锚点当前在 PDF 文件中的高度 = 实际的高度 + 之前补充的高度
      const existHeight = y + cumulativeCompensationHeight
      // 计算当前锚点应该补充多少高度
      const currentElPatchHeight = existHeight % 1524
      // 当前元素之后的累积补充高度
      cumulativeCompensationHeight += currentElPatchHeight
      // (当前高度 + 补充高度) / 1524 来计算实际的页码
      const pageNum = Math.ceil((existHeight + currentElPatchHeight) / 1524) || 1
      // 加 1 是因为目录页占了一页，所以新闻页算是从第二页开始的
      pageNumSpan.appendChild(document.createTextNode(pageNum + 1))

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
    scale,
    // 设置 PDF 文件的页边距，避免内容完全贴边
    margin: {
      top: 80 * scale,
      right: 80 * scale,
      bottom: 80 * scale,
      left: 80 * scale
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

// generatePDF()