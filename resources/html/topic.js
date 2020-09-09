const vscode = acquireVsCodeApi();

// 设置标题
vscode.postMessage({
  command: 'setTitle',
  title: document.title
});

// 给图片添加查看图片的功能
document.querySelectorAll('.topic-content img').forEach((img) => {
  img.onload = () => {
    if (img.width < 100 && img.height < 100) {
      return;
    }
    img.style.cursor = 'zoom-in';
    img.onclick = () => {
      console.log(img.src);
      vscode.postMessage({
        command: 'browseImage',
        src: img.src
      });
    };
  };
});

// 图片地址的a标签，点击打开图片
const supportImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
supportImageTypes.forEach((type) => {
  document.querySelectorAll(`.topic-content a[href$=".${type}"]`).forEach((a) => {
    a.dataset['imageSrc'] = a.href;
    // vsc中 return false 不能阻止a标签跳转。曲线救国
    a.href = 'javascript:;';
    a.onclick = () => {
      console.log(a.dataset['imageSrc']);
      vscode.postMessage({
        command: 'browseImage',
        src: a.dataset['imageSrc']
      });
      return false;
    };
  });
});

// 指向站内地址的a标签，点击在插件内打开
document.querySelectorAll('.topic-content a[href^="https://www.v2ex.com"]').forEach((a) => {
  // 检查是否帖子链接并取地址
  if (!/(https:\/\/www.v2ex.com\/t\/\d+)/.test(a.href)) {
    return;
  }

  a.dataset['href'] = RegExp.$1;
  a.href = 'javascript:;';
  a.onclick = () => {
    console.log(a.dataset['href']);
    vscode.postMessage({
      command: 'openTopic',
      link: a.dataset['href']
    });
    return false;
  };
});
