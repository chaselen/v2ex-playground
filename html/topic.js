const vscode = acquireVsCodeApi()

const vsPostMessage = (command, messages) => {
  vscode.postMessage({
    command: command,
    _topic: _topic,
    ...(messages || {})
  })
}

// 设置标题
vsPostMessage('setTitle', {
  title: document.title
})

// imgur图片代理
document.querySelectorAll('.topic-content img').forEach(img => {
  if (img.src.startsWith('https://i.imgur.com/')) {
    console.log(`代理图片：${img.src}`)
    img.src = 'https://img.noobzone.ru/getimg.php?url=' + encodeURIComponent(img.src)
  }
})

// 给图片添加查看图片的功能
document.querySelectorAll('.topic-content img').forEach(img => {
  img.style.cursor = 'zoom-in'
  // 判断img是否已加载
  if (img.complete) {
    console.log('图片已加载')
    return
  }
  img.onclick = () => {
    // if (img.width < 100 && img.height < 100) {
    //   return
    // }
    console.log('查看图片')
    vsPostMessage('browseImage', {
      src: img.src
    })
  }
})

// 图片地址的a标签，点击打开图片
const supportImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
supportImageTypes.forEach(type => {
  document.querySelectorAll(`.topic-content a[href$=".${type}"]`).forEach(a => {
    const imageSrc = a.href
    // vsc中 return false 不能阻止a标签跳转。曲线救国
    a.href = 'javascript:;'
    a.onclick = () => {
      return false
    }

    // 如果a标签中的的是img元素，则忽略（因为img标签已经添加了点击事件）
    if (a.childNodes[0].nodeName === 'IMG') {
      return
    }

    a.addEventListener('click', () => {
      vsPostMessage('browseImage', {
        src: imageSrc
      })
    })
  })
})

/**
 * 指向站内地址的a标签，点击在插件内打开
 * 有几种：
 * 1. 完整地址：https://www.v2ex.com/t/123456，域名也可能是v2ex.com
 * 2. 相对地址：/t/123456
 */
document.querySelectorAll('.topic-content a[href*="/t/"]').forEach(a => {
  // 取帖子id
  let match = /\/t\/(\d+)/.exec(a.href)
  if (!match) {
    return
  }
  let topicId = match[1]
  a.dataset['topicId'] = topicId
  a.href = 'javascript:;'
  a.onclick = () => {
    vsPostMessage('openTopic', {
      topicId: topicId
    })
    return false
  }
})

// 评论
function onSubmit() {
  const content = (document.querySelector('#replyBox').value || '').trim()
  if (!content) {
    return
  }

  vsPostMessage('postReply', {
    content: content
  })
}

// 感谢回复者
function thankReply(e) {
  const { replyId } = e.target.dataset
  vsPostMessage('thankReply', {
    replyId: replyId
  })
}

// 快捷回复楼层
function floorReply(e) {
  const { replyAuthor, replyFloor } = e.target.dataset
  document.querySelector('#replyBox').value = '@' + replyAuthor + ' #' + replyFloor + ' '
  document.querySelector('#replyBox').focus()
}
