# TypeWord 课文打字

一个面向小学生的英文课文词打字和默写练习工具。默认内置沪教牛津版四年级下册知识清单词库，可直接在浏览器中练习，也支持从 PDF 或 JSON 导入自己的词库。

在线访问：

https://xianliang.github.io/type-word/

## 功能

- 导入 PDF，按规则提取“重点单词”和“常考短语”
- 根据中文提示输入英文，支持点“翻译”显示英文答案
- 基准键练习、课文词练习、易错词复练、默写模式
- 正确率、WPM、当前组进度、词库数量、默写进度统计
- 已练、未练、错过状态标记
- 屏幕键盘和手指分区提示
- 练习进度保存在浏览器 `localStorage`，刷新后可继续

## 题库说明

默认题库文件：

- `public/wordbank.json`
- 发布产物中对应 `dist/wordbank.json`

当前内置题库来自：

`沪教牛津版四下知识清单全(1).pdf`

共提取 `247` 个单词和短语。

浏览器里手动导入 PDF 或 JSON 后，题库和进度会保存在当前浏览器的 `localStorage`，不会自动写回仓库。如果需要固化为默认题库，需要导出或重新生成 JSON，并替换 `public/wordbank.json`。

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

默认打开：

```text
http://127.0.0.1:5173/
```

如果端口被占用，Vite 会自动切到下一个端口。

构建：

```bash
pnpm build
```

## 从 PDF 生成词库

脚本：

```bash
node tools/extract-pdf-wordbank.mjs <输入PDF路径> public/wordbank.json
```

示例：

```bash
node tools/extract-pdf-wordbank.mjs ./source.pdf public/wordbank.json
```

脚本会提取每个 Unit 前面的“重点单词”和“常考短语”，生成可被页面自动加载的 JSON 词库。

## GitHub Pages 发布

项目发布在 GitHub Pages：

```text
https://xianliang.github.io/type-word/
```

由于站点位于 `/type-word/` 子路径，发布前需要使用 Pages base 构建：

```bash
GITHUB_PAGES=true pnpm build
```

Windows PowerShell：

```powershell
$env:GITHUB_PAGES='true'; pnpm build
```

当前仓库使用 `gh-pages` 分支发布构建产物。发布步骤：

```bash
git add -f dist
git commit -m "Update Pages build"
git subtree split --prefix dist -b gh-pages
git push -f origin gh-pages
```

源码保存在 `main` 分支，发布产物保存在 `gh-pages` 分支。
