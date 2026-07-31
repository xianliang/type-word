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

## 自定义题库导入

推荐公开使用者用 JSON 导入自己的题库。PDF 结构差异很大，网页里的 PDF 提取适合规整资料；如果识别不准，可以把 PDF 发给 AI，让 AI 按下面模板生成 JSON，再回到页面导入。

### 题库模板

```json
{
  "schemaVersion": 1,
  "name": "我的英语词库",
  "description": "四年级英语 Unit 1-3",
  "source": {
    "type": "pdf",
    "title": "教材或资料名称",
    "grade": "四年级",
    "term": "下册"
  },
  "items": [
    {
      "unit": "Unit 1",
      "type": "word",
      "english": "daily",
      "chinese": "每日的；日常的",
      "tags": ["重点单词"]
    },
    {
      "unit": "Unit 1",
      "type": "phrase",
      "english": "get up",
      "chinese": "起床",
      "tags": ["常考短语"]
    }
  ]
}
```

也支持最简数组格式：

```json
[
  {
    "english": "daily",
    "chinese": "每日的；日常的",
    "unit": "Unit 1",
    "type": "word"
  },
  {
    "english": "get up",
    "chinese": "起床",
    "unit": "Unit 1",
    "type": "phrase"
  }
]
```

字段说明：

- `english`：必填，英文单词、短语或句子。
- `chinese`：必填，中文提示。多个释义建议用中文分号 `；` 分隔。
- `unit`：推荐填写，用于按单元整理。
- `type`：推荐使用 `word`、`phrase` 或 `sentence`。
- `tags`：可选，记录“重点单词”“常考短语”等来源标签。

### 给 AI 的提示词

```text
请从我上传的 PDF、图片或文本中提取英语练习题库，并生成 TypeWord 可导入的 JSON。

要求：
1. 只输出合法 JSON，不要 Markdown，不要解释文字。
2. JSON 使用下面结构：
{
  "schemaVersion": 1,
  "name": "题库名称",
  "description": "简短说明",
  "source": {
    "type": "pdf",
    "title": "资料名称",
    "grade": "",
    "term": ""
  },
  "items": []
}
3. items 中每一项包含：
- unit：单元名称，例如 "Unit 1"
- type：只能是 "word"、"phrase" 或 "sentence"
- english：英文单词、短语或句子，短语要保留空格
- chinese：对应中文释义，多个释义用中文分号“；”隔开
- tags：数组，例如 ["重点单词"]、["常考短语"]

提取规则：
1. 优先提取重点单词、核心词汇、常考短语、重点句型。
2. 不要提取页码、标题、说明文字、练习题编号。
3. 不确定中文释义的内容请跳过，不要乱编。
4. 英文重复时只保留一次。
5. 按 Unit 顺序排列。
6. 最终只返回 JSON。
```

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
