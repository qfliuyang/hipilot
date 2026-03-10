# AI in ASIC: 芯片设计师的完整开发指南

> **构建智能芯片设计助手：从概念到代码**
>
> *从硅片 expertise 到 AI 开发的分层之旅*

---

## 目录

1. [范式转变：为什么是智能体，为什么是现在](#第1章-范式转变)
2. [AI 的编程语言：硬件工程师的 JavaScript 指南](#第2章-javascript)
3. [三层架构揭秘](#第3章-架构)
4. [MCP：连接一切的协议](#第4章-mcp)
5. [技能：编码 RTL2GDS 专业知识](#第5章-技能)
6. [HiPilot 代码库：完整 walkthrough](#第6章-代码库)
7. [构建你的第一个扩展](#第7章-扩展)
8. [LittleBrain：基于知识的编排](#第8章-littlebrain)
9. [认证与测试结果](#第9章-认证)

---

## 第1章 范式转变

### 从脚本到智能体：一个历史类比

**1990年代：ASIC 自动化的黎明**

芯片设计师手动放置单元、布线、检查时序。然后综合工具出现了——*脚本* 将 RTL 自动转换为门级电路。

```
手动设计 → 脚本化综合 → 自动化布局布线
```

**2020年代：AI 智能体的黎明**

我们正站在类似的转折点。传统的 EDA 脚本正在让位于 **AI 智能体**——这些系统不只是执行预定的步骤，而是 *根据上下文推理* 该采取什么步骤。

```
固定脚本 → 智能智能体 → 自主设计
```

### 什么是 AI 智能体？

一个 **AI 智能体** 是一个计算实体，它能够：

1. **感知** 环境（读取输出、监控状态、捕获结果）
2. **推理** 该做什么（使用 LLM 规划动作）
3. **通过工具行动**（执行命令、运行分析）
4. **从反馈中学习**（根据结果调整）

**把它想象成一位资深工程师：**
- 像你阅读时序报告一样阅读设计状态
- 像你决定有用偏斜和缓冲器插入之间选择一样决定下一步
- 像你执行 Tcl 一样通过工具执行
- 在失败时适应（CTS 偏斜太高？尝试不同的树拓扑）

### RTL2GDS 示例：为什么它重要

RTL-to-GDS 流程是完美的例子，因为它体现了芯片设计中所有复杂的内容：

- **多阶段：** 9+ 个不同阶段（综合、布局、布局规划、CTS、布线...）
- **相互依赖：** 布局中的决策影响 CTS；CTS 影响布线
- **容易出错：** 每个阶段可能以几十种方式失败
- **上下文依赖：** 正确的修复取决于具体的违规、技术、约束

**传统方法：** 编写一个顺序运行所有阶段的单体脚本。当它在第 5 阶段失败时，你手动调试、修复，然后从第 4 阶段重新开始。

**智能体方法：** 一个智能系统，运行每个阶段，检查结果，适应错误，并决定是继续、重试还是尝试替代方法。

---

## 第2章 AI 的编程语言

### JavaScript：HiPilot 的语言

**等等，JavaScript？不是 Python？不是 C++？**

是的，JavaScript。原因如下：

1. **Node.js** 允许 JavaScript 作为服务器运行（不仅在浏览器中）
2. **JSON**（JavaScript 对象表示法）是现代 API 的通用语言
3. **npm** 拥有最大的开源包生态系统
4. **MCP SDK**（模型上下文协议）是用 JavaScript/TypeScript 编写的

**但别担心。** 如果你理解 Tcl（你确实理解），JavaScript 出奇地相似：

| 概念 | Tcl | JavaScript |
|------|-----|------------|
| 变量 | `set x 5` | `let x = 5;` |
| 条件 | `if {$x > 0} {puts "positive"}` | `if (x > 0) { console.log("positive"); }` |
| 循环 | `foreach item $list { ... }` | `for (let item of list) { ... }` |
| 函数 | `proc myFunc {arg} { return $arg }` | `function myFunc(arg) { return arg; }` |
| 列表 | `list 1 2 3` | `[1, 2, 3]` |
| 字典 | `dict set obj key value` | `obj.key = value` 或 `obj[key] = value` |

### 面向 ASIC 工程师的 JavaScript 速成课程

#### 2.1 变量和类型

```javascript
// 数字（像 Tcl 中的整数/浮点数）
let utilization = 0.75;
let cellCount = 15000;

// 字符串（像 Tcl 中一样）
let designName = "ibex_core";
let report = `Setup WNS: ${wns}ns`;  // 带插值的模板字符串

// 布尔值
let isRouted = true;
let hasViolations = false;

// 数组（像 Tcl 列表）
let stages = ["synthesis", "floorplan", "placement", "cts", "routing"];
let firstStage = stages[0];  // "synthesis"

// 对象（像 Tcl 字典，但更强大）
let timingReport = {
    wns: -0.059,
    tns: -0.921,
    violatingPaths: 44,
    isClean: false
};

// 像字典一样访问
let worstSlack = timingReport.wns;  // -0.059
let totalSlack = timingReport["tns"];  // -0.921
```

#### 2.2 函数

```javascript
// 基本函数（像 Tcl proc）
function calculateDensity(area, totalArea) {
    return area / totalArea;
}

// 带默认参数的函数
function reportTiming(maxPaths = 10, pathType = "summary") {
    return `Reporting ${maxPaths} paths as ${pathType}`;
}

// 箭头函数（更短语法，常用）
const isTimingClean = (wns) => wns >= 0;

// 异步函数（对 AI 智能体至关重要 - 处理等待）
async function runPlacement(timeoutSeconds) {
    console.log("Starting placement...");
    // 等待布局完成
    await sleep(timeoutSeconds * 1000);
    console.log("Placement complete!");
    return { status: "success", density: 0.75 };
}
```

#### 2.3 控制流

```javascript
// If/else（像 Tcl if）
if (wns < 0) {
    console.log("Setup violation detected");
    runOptimization();
} else if (wns < 0.010) {
    console.log("Close to target, minor tweaks needed");
} else {
    console.log("Timing clean!");
}

// Switch（像 Tcl switch）
switch (stage) {
    case "placement":
        runPlacement();
        break;
    case "cts":
        runCTS();
        break;
    case "routing":
        runRouting();
        break;
    default:
        console.log("Unknown stage");
}

// For 循环（像 Tcl for/foreach）
for (let i = 0; i < stages.length; i++) {
    console.log(`Stage ${i}: ${stages[i]}`);
}

// For-of 循环（像 Tcl foreach）
for (let stage of stages) {
    console.log(`Running ${stage}...`);
}

// While 循环（处理直到完成）
while (hasViolations) {
    fixViolations();
    hasViolations = checkViolations();
}
```

#### 2.4 数据处理（数组和对象）

```javascript
// 数组操作（像 Tcl 列表操作）
let violations = [
    { path: "reg1_to_reg2", slack: -0.050 },
    { path: "reg3_to_reg4", slack: -0.120 },
    { path: "reg5_to_reg6", slack: -0.030 }
];

// Filter：只获取关键违规
let critical = violations.filter(v => v.slack < -0.100);
// 结果：[{ path: "reg3_to_reg4", slack: -0.120 }]

// Map：只提取路径名
let paths = violations.map(v => v.path);
// 结果：["reg1_to_reg2", "reg3_to_reg4", "reg5_to_reg6"]

// Find：获取第一个匹配条件的违规
let worst = violations.find(v => v.slack < -0.100);
// 结果：{ path: "reg3_to_reg4", slack: -0.120 }

// Reduce：求所有负偏差的和（TNS 计算）
let tns = violations.reduce((sum, v) => sum + v.slack, 0);
// 结果：-0.200
```

#### 2.5 异步编程（关键概念）

**这对 AI 智能体至关重要。** EDA 工具需要时间。你不能只是同步等待——你需要处理异步操作。

```javascript
// Promise：一个将在未来存在的值
const placementPromise = new Promise((resolve, reject) => {
    // 开始布局
    runInnovus("place_opt_design");

    // 当布局完成时，resolve promise
    setTimeout(() => {
        if (placementSucceeded) {
            resolve({ density: 0.75, status: "success" });
        } else {
            reject(new Error("Placement failed"));
        }
    }, 60000);  // 60 秒
});

// 使用 async/await（更干净的语法）
async function runRTL2GDS() {
    try {
        // 每个 'await' 暂停执行直到 promise resolve
        await runSynthesis();
        await runFloorplan();
        await runPlacement();
        await runCTS();
        await runRouting();
        await exportGDS();

        console.log("RTL2GDS complete!");
    } catch (error) {
        console.error("Flow failed:", error.message);
    }
}
```

#### 2.6 模块和导入

```javascript
// 导入内置模块（像 Tcl 'package require'）
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// 从本地文件导入
import { FlowCertifier } from './src/hitestbot/core/FlowCertifier.js';

// 从 npm 包导入
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
```

---

## 第3章 三层架构

### 智能的架构

每个 AI 智能体系统——从 HiPilot 到 ChatGPT 插件——都遵循三层架构。理解这些层对开发至关重要。

```
┌─────────────────────────────────────────────────────────────────────┐
│  第3层：编排                                                         │
│  "大脑" - 决定做什么                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  • 大型语言模型（Claude）                                            │
│  • 解释用户意图（"运行 rtl2gds"）                                    │
│  • 规划多步骤工作流                                                  │
│  • 读取技能（你的专业知识）                                          │
│  • 决定调用哪些工具                                                  │
│  • 对结果进行推理                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ MCP 协议（JSON-RPC）
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  第2层：协议                                                         │
│  "神经系统" - 传输和翻译                                             │
├─────────────────────────────────────────────────────────────────────┤
│  • MCP 服务器（Node.js 进程）                                        │
│  • 接收结构化请求                                                    │
│  • 根据 schema 验证参数                                              │
│  • 管理工具执行生命周期                                              │
│  • 返回结构化响应                                                    │
│  • 处理错误和重试                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ 系统调用（tmux、文件系统）
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  第1层：执行                                                         │
│  "手" - 做实际的工作                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  • EDA 工具（Innovus、ICC2、PrimeTime）                              │
│  • 执行 Tcl 命令                                                     │
│  • 生成报告和数据文件                                                │
│  • 返回原始输出                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 第3层：编排（RTL2GDS 智能）

当你在 HiPilot 中输入 `/rtl2gds` 时，第3层发生的事情：

```
用户："/rtl2gds"
    │
    ▼
Claude 读取命令
    │
    ▼
Claude 加载技能：skills/ibex-rtl2gds-flow.md
    │
    ▼
Claude 创建计划：
    第1阶段：设计初始化 → 第2阶段：布局规划 → 第3阶段：电源规划
    → 第4阶段：布局 → 第5阶段：CTS → 第6阶段：CTS 后优化
    → 第7阶段：布线 → 第8阶段：布线后优化 → 第9阶段：芯片完成
    │
    ▼
对每个阶段：
    1. 从技能加载阶段特定 Tcl
    2. 调用 MCP 执行
    3. 等待完成
    4. 检查结果（QoR、错误）
    5. 如果错误 → 诊断并重试
    6. 如果成功 → 保存检查点，继续下一阶段
    │
    ▼
报告带 WNS/TNS 的最终结果
```

**关键洞察：** Claude 不只是运行命令——它维护状态、做决定、适应。像你一样。

### 第2层：协议（MCP 现实）

**什么是 MCP，为什么它存在？**

MCP（模型上下文协议）是 AI 系统与外部工具交互的标准化方式。没有 MCP：
- 每个工具都需要自定义集成代码
- 安全性不一致
- 上下文管理是临时的
- 工具发现不可能

**有了 MCP：**
- 标准 JSON-RPC 通信
- 结构化工具 schema
- 内置错误处理
- 自动工具发现

### 第1层：执行（EDA 工具）

这是你的领域。Innovus、ICC2、PrimeTime——这些是做实际工作的工具。智能体不取代它们；它编排它们。

---

## 第4章 MCP 深度解析

### MCP 在 RTL2GDS 上下文中的工作原理

让我们追踪一个 MCP 调用通过 RTL2GDS 流程：执行第4阶段（布局）。

#### 步骤1：工具发现

当 Claude 启动时，它问 MCP 服务器：*"你有什么工具？"*

**请求（从 Claude 到 MCP）：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**响应（从 MCP 到 Claude）：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "eda.detect_tool",
        "description": "检查 EDA 工具是否在目标窗格中运行",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      },
      {
        "name": "eda.execute_and_verify",
        "description": "在 EDA 工具中执行 Tcl 并验证成功",
        "inputSchema": {
          "type": "object",
          "properties": {
            "tcl": {
              "type": "string",
              "description": "要执行的 Tcl 命令"
            },
            "description": {
              "type": "string",
              "description": "这是做什么的（用于日志记录）"
            },
            "timeout": {
              "type": "number",
              "description": "超时秒数（默认：60）"
            }
          },
          "required": ["tcl"]
        }
      },
      {
        "name": "eda.diagnose_error",
        "description": "分析 EDA 错误输出并建议修复",
        "inputSchema": {
          "type": "object",
          "properties": {
            "output": {
              "type": "string",
              "description": "来自 EDA 工具的错误输出"
            }
          },
          "required": ["output"]
        }
      },
      {
        "name": "qor.snapshot",
        "description": "保存时序指标用于比较",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "快照标识符"
            }
          }
        }
      }
    ]
  }
}
```

#### 步骤2：工具调用（运行布局）

Claude 决定运行布局。它构造 Tcl 并调用 MCP 工具。

**请求：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "eda.execute_and_verify",
    "arguments": {
      "tcl": "# Stage 4: Placement\nsource /home/EDA/ibex_work_upload/result/pr/data/floor_plan.enc\nplace_opt_design\nsetPlaceMode -place_detail_opt true\nplaceDesign\nsaveDesign result/pr/data/placement.enc\nputs \"PLACEMENT_COMPLETE\"",
      "description": "第4阶段布局：place_opt_design",
      "timeout": 300
    }
  }
}
```

#### 步骤3：MCP 服务器处理

MCP 服务器接收此请求并：

1. 根据 schema 验证参数
2. 将 Tcl 写入临时文件
3. 通过 tmux 发送到 EDA 窗格
4. 监控完成
5. 捕获输出
6. 检查错误
7. 提取 QoR 指标

**服务器内部发生的事情：**
```javascript
async function handleExecuteAndVerify(args) {
    const { tcl, description, timeout = 60 } = args;

    // 1. 将 Tcl 写入临时文件
    const tmpFile = `/tmp/hipilot/placement_${Date.now()}.tcl`;
    await writeFile(tmpFile, tcl);

    // 2. 通过 tmux 发送到 Innovus
    execSync(`tmux -L hipilot send-keys -t hipilot:0.1 "source ${tmpFile}" C-m`);

    // 3. 轮询完成
    const startTime = Date.now();
    while (Date.now() - startTime < timeout * 1000) {
        const output = execSync('tmux -L hipilot capture-pane -p -t hipilot:0.1');

        if (output.includes('PLACEMENT_COMPLETE')) {
            // 执行完成
            const errors = extractErrors(output);
            const qor = extractQoR(output);

            return {
                content: [{ type: 'text', text: output }],
                isError: errors.length > 0,
                result: {
                    status: errors.length > 0 ? 'error' : 'success',
                    errors,
                    qor
                }
            };
        }

        await sleep(1000);  // 检查前等待 1 秒
    }

    // 超时
    return {
        isError: true,
        content: [{ type: 'text', text: 'Placement timed out' }]
    };
}
```

#### 步骤4：响应给 Claude

**响应：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "... (完整的 Innovus 输出) ..."
      }
    ],
    "isError": false,
    "result": {
      "status": "success",
      "errors": [],
      "qor": {
        "wns": -0.123,
        "tns": -2.456,
        "violatingPaths": 15
      }
    }
  }
}
```

#### 步骤5：Claude 的决定

Claude 看到：
- 状态：成功
- WNS：-0.123ns（负的，但可接受）
- 违规路径：15

它决定：*"布局成功。WNS 是 -0.123ns，有 15 个违规。这可以继续 CTS。我将保存 QoR 快照并继续。"*

**下一个 MCP 调用：**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "qor.snapshot",
    "arguments": {
      "name": "after_placement",
      "description": "CTS 前的布局后时序"
    }
  }
}
```

### 为什么这个架构重要

**关注点分离：**
- Claude（第3层）关注 *做什么* 和 *为什么*
- MCP（第2层）关注 *如何* 通信
- EDA 工具（第1层）关注 *做* 工作

**可测试性：**
- 你可以独立测试 MCP 服务器
- 你可以用模拟 MCP 响应测试 Claude 的推理
- 你可以用传统方式测试 EDA 工具

**可扩展性：**
- 无需更改 Claude 即可向 MCP 添加新工具
- 无需触及 MCP 即可改进 Claude 的推理
- 无需更改第 2-3 层即可交换 EDA 工具（Innovus ↔ ICC2）

---

## 第5章 技能——编码 RTL2GDS 专业知识

### 什么是技能？

一个 **技能** 是以 AI 可以遵循的格式编写的你的专业知识。它不是代码——它是一种结构化的方法论。

**类比：**
- 技能就像你为一位新大学毕业生写的 **培训手册**
- 它解释 *做什么*、*为什么做*、以及 *当事情出错时该怎么做*
- AI 阅读它并遵循你的方法论

### 生产级技能的解剖

这是 HiPilot 使用的实际 `rtl2gds.md` 技能：

```markdown
---
name: /rtl2gds
description: >
  为 Ibex 设计运行完整的 Innovus RTL-to-GDS 流程。
  你自己使用 MCP 工具驱动每个阶段。
---

# RTL-to-GDS 流程

## 概述

这个技能编排一个完整的 9 阶段 RTL-to-GDS 实现：
1. 设计初始化 + MMMC
2. 布局规划
3. 电源规划
4. 布局
5. 时钟树综合
6. CTS 后优化
7. 布线
8. 布线后优化
9. 芯片完成 + GDS 导出

每个阶段独立执行以实现干净的数据库管理。

## 关键规则

**不要调用 `workflow.run` 或 `eda.rtl2gds.run_full_flow`。**
你自己编排每个阶段。如果阶段失败，你诊断并修复它。
批处理执行器绕过你的智能——不要使用它们。

## 阶段执行模式

对每个阶段，遵循这个确切序列：

1. **获取 Tcl：** 加载技能以获取阶段特定 Tcl
2. **执行：** 用完整 Tcl 块调用 `eda.execute_and_verify`
3. **检查结果：** 读取响应（状态、错误、警告、qor）
4. **处理错误：** 如果有错误，调用 `eda.diagnose_error` 并重试
5. **如果成功：** 用描述性名称调用 `qor.snapshot`
6. **报告：** 告诉工程师："第 X 阶段：完成。WNS=Y，违规=Z"
7. **继续：** 仅当当前阶段成功时才继续

## 10 个阶段

| # | 阶段 | 工具 | 超时 | 关键检查 |
|---|------|------|------|----------|
| 0 | 综合 + DFT | dc_shell | 300s | 检查网表存在 |
| 1 | 设计初始化 + MMMC | innovus | 180s | MMMC 视图激活 |
| 2 | 布局规划 | innovus | 120s | 芯片面积、IO 放置 |
| 3 | 电源规划 | innovus | 120s | VDD/VSS 条纹 |
| 4 | 布局 | innovus | 300s | 布局后 WNS |
| 5 | CTS | innovus | 300s | 偏斜目标达成 |
| 6 | CTS 后优化 | innovus | 300s | 建立/保持清洁 |
| 7 | 布线 | innovus | 600s | DRC 清洁 |
| 8 | 布线优化 | innovus | 300s | 布线后时序 |
| 9 | 芯片完成 + GDS | innovus | 300s | GDS 导出 |

## 错误恢复协议

当阶段失败时，遵循这个优先级：

1. **第一次失败：** 用 `eda.diagnose_error` 诊断，修复，立即重试
2. **第二次失败：** 尝试替代方法（不同 Tcl 选项）
3. **第三次失败：** 记录详细笔记，尝试创造性解决方案
4. **只有那时：** 用完整历史报告给工程师

### 示例：布局失败恢复

```
阶段：布局
结果：失败 - 80% 利用率时高拥塞

操作：
1. session.add_note({category:"error",
     content:"布局失败，80% 利用率时高拥塞"})
2. 修复：用 setPlaceMode 将利用率调整到 70%
3. 重试：布局成功
4. 继续 CTS
```

## 最终 QoR 摘要（必需）

第 9 阶段后，你必须提取并显示最终时序指标。

**步骤 1：** 运行时序提取
```
mcp__hipilot-eda__eda.execute_and_verify({
  tcl: "timeDesign -postRoute -prefix final_summary...",
  description: "提取最终时序指标",
  timeout: 120
})
```

**步骤 2：** 保存快照
```
mcp__hipilot-eda__qor.snapshot({
  name: "rtl2gds_final",
  description: "完整 RTL-to-GDS 流程后的最终 QoR"
})
```

**步骤 3：** 用明确数字报告给工程师

格式：
```
✅ RTL-to-GDS 流程完成！

最终 QoR 摘要：
┌──────────────────┬──────────────────────────────┐
│ 指标              │ 值                           │
├──────────────────┼──────────────────────────────┤
│ WNS（建立）       │ X.XXX ns    ← 必需            │
│ TNS（建立）       │ X.XXX ns    ← 必需            │
│ 建立违规          │ N 路径      ← 必需            │
│ 保持违规          │ N 路径                        │
│ GDS               │ result/pr/data/ibex_core.gds │
└──────────────────┴──────────────────────────────┘
```

**关键：** 你必须包含实际的 WNS 和 TNS 数字。
不要只说"流程完成"而不显示时序指标。
```

### 深层概念：技能作为状态机

一个技能隐式定义了一个状态机。对于 RTL2GDS：

```
[初始]
    │
    ▼ (加载技能，检测工具)
[工具就绪]
    │
    ▼ (执行第1阶段)
[第1阶段运行中]
    │
    ├── 错误 ──► [诊断错误] ──► [第1阶段运行中] (重试)
    │
    └── 成功 ──► [第1阶段完成]
                    │
                    ▼ (保存检查点)
              [第2阶段运行中]
                    │
                    ... (对所有阶段重复)
                    │
                    ▼
              [所有阶段完成]
                    │
                    ▼ (提取 QoR)
              [报告中]
                    │
                    ▼
              [完成]
```

每个状态转换都是一个决策点。技能告诉 AI：
- 在每个状态检查什么
- 成功时做什么
- 如何处理错误
- 何时停止并寻求帮助

### 技能设计原则

**1. 明确的决策点**

不要说：*"修复时序问题"*
要说：*"如果 WNS < -0.100ns，使用有用偏斜。如果 -0.100ns ≤ WNS < 0，使用单元尺寸调整。如果 WNS ≥ 0，继续下一阶段。"*

**2. 错误恢复路径**

每个错误都应该有文档化的恢复策略：

```markdown
## 常见错误

### 错误："布局期间高拥塞"
**原因：** 目标利用率太高
**修复：**
1. 降低目标利用率：`setPlaceMode -place_detail_utilization 0.70`
2. 重试布局
3. 如果仍然失败，考虑宏布局调整

### 错误："时钟树综合失败"
**原因：** 不现实的偏斜目标
**修复：**
1. 放宽偏斜目标：`setCTSMode -target_skew 0.200`
2. 检查时钟根约束
```

**3. 验证检查点**

每个主要动作都应该有验证步骤：

```markdown
### 布局后

验证：
- [ ] 布局无错误完成
- [ ] 利用率 < 85%
- [ ] 拥塞图可接受
- [ ] WNS 已记录（即使是负的）
- [ ] 检查点已保存
```

---

## 第6章 HiPilot 代码库——完整 walkthrough

### 项目结构

```
hipilot/
├── bin/hipilot                    # 入口 bash 脚本
│
├── servers/                       # 第2层：MCP 协议
│   ├── eda/index.js              # EDA 工具 MCP 服务器（54 个工具）
│   ├── tmux/index.js             # Tmux 窗格 MCP 服务器（8 个工具）
│   └── knowledge/index.js        # 技能/知识 MCP 服务器（7 个工具）
│
├── skills/                        # 第3层：智能体指令
│   ├── ibex-rtl2gds-flow.md      # 主 RTL2GDS 技能
│   ├── fix-setup-timing.md       # 时序收敛技能
│   ├── cts-clock-tree.md         # CTS 技能
│   └── ... (共 34 个技能)
│
├── templates/                     # Tcl 生成
│   ├── cadence/                  # Innovus 模板（11 个）
│   └── synopsys/                 # ICC2 模板（11 个）
│
├── src/
│   ├── hitestbot/                # 测试框架
│   │   └── core/
│   │       ├── FlowCertifier.js  # 虚拟人类测试器
│   │       ├── FlowReporter.js   # 报告生成
│   │       └── ObservationPoint.js # 证据捕获
│   │
│   ├── lib/                      # 共享工具
│   │   ├── paths.js             # 路径解析
│   │   ├── mode.js              # 手动/自动模式
│   │   └── mcp-logger.js        # MCP 调用日志
│   │
│   └── cli.js                    # TUI 仪表板
│
└── deploy/eda-server/            # 部署到 EDA 服务器
    ├── CLAUDE.md                 # AI 身份（HiPilot 的"宪法"）
    └── .claude/commands/         # 斜杠命令
        └── rtl2gds.md            # /rtl2gds 命令
```

### EDA MCP 服务器（servers/eda/index.js）

这是第 2 层的核心。让我们 walk through 关键组件：

#### 1. 工具注册

```javascript
// servers/eda/index.js - 第 1-100 行（简化）

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// 带 schema 的工具定义
const TOOLS = [
  {
    name: 'eda.execute_and_verify',
    description: '在 EDA 工具中执行 Tcl 并验证成功',
    inputSchema: {
      type: 'object',
      properties: {
        tcl: {
          type: 'string',
          description: '要在 EDA 工具中执行的 Tcl 命令'
        },
        description: {
          type: 'string',
          description: '这是做什么的（人类可读）'
        },
        timeout: {
          type: 'number',
          description: '超时秒数（默认：60）',
          default: 60
        }
      },
      required: ['tcl']
    }
  },
  {
    name: 'eda.detect_tool',
    description: '检测哪个 EDA 工具正在运行（如果有）',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'eda.diagnose_error',
    description: '分析 EDA 错误输出并建议修复',
    inputSchema: {
      type: 'object',
      properties: {
        output: {
          type: 'string',
          description: '来自 EDA 工具的错误输出'
        }
      },
      required: ['output']
    }
  }
];
```

#### 2. 服务器初始化

```javascript
// servers/eda/index.js - 第 100-150 行

// 创建 MCP 服务器实例
const server = new Server(
  {
    name: 'hipilot-eda',
    version: '0.7.0'
  },
  {
    capabilities: {
      tools: {}  // 我们提供工具
    }
  }
);

// 设置请求处理程序
server.setRequestHandler('tools/list', async () => {
  return { tools: TOOLS };
});
```

#### 3. 核心：execute_and_verify

```javascript
// servers/eda/index.js - 第 150-250 行

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'eda.execute_and_verify':
      return await executeAndVerify(args);
    case 'eda.detect_tool':
      return await detectTool();
    case 'eda.diagnose_error':
      return await diagnoseError(args.output);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function executeAndVerify({ tcl, description, timeout = 60 }) {
  // 从环境获取 tmux socket
  const socket = process.env.HIPILOT_SESSION || 'hipilot';

  // 创建唯一执行 ID
  const execId = `exec_${Date.now()}`;
  const tmpFile = join('/tmp', `hipilot_${execId}.tcl`);

  // 用完成检测标记包装 Tcl
  const wrappedTcl = `
puts "HIPILOT_START:${execId}"
${tcl}
puts "HIPILOT_END:${execId}"
`;

  // 写入临时文件
  writeFileSync(tmpFile, wrappedTcl);

  // 通过 tmux 发送到 EDA 窗格
  const tmuxCmd = `tmux -L ${socket} send-keys -t ${socket}:0.1 "source ${tmpFile}" C-m`;
  execSync(tmuxCmd);

  // 轮询完成
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;

  while (Date.now() - startTime < timeoutMs) {
    // 捕获窗格输出
    const captureCmd = `tmux -L ${socket} capture-pane -p -t ${socket}:0.1`;
    const output = execSync(captureCmd, { encoding: 'utf-8' });

    // 检查完成标记
    if (output.includes(`HIPILOT_END:${execId}`)) {
      // 提取标记之间的部分
      const startIdx = output.indexOf(`HIPILOT_START:${execId}`);
      const endIdx = output.indexOf(`HIPILOT_END:${execId}`);
      const executionOutput = output.substring(startIdx, endIdx);

      // 检查错误
      const errorPatterns = [/\*\*ERROR/i, /FATAL/i, /Command not found/i];
      const errors = [];
      for (const pattern of errorPatterns) {
        if (pattern.test(executionOutput)) {
          errors.push(`Error pattern matched: ${pattern}`);
        }
      }

      // 提取 QoR 指标
      const qor = extractQoR(executionOutput);

      return {
        content: [
          { type: 'text', text: executionOutput }
        ],
        isError: errors.length > 0,
        result: {
          status: errors.length > 0 ? 'error' : 'success',
          errors,
          qor
        }
      };
    }

    // 再次检查前等待
    await sleep(1000);
  }

  // 超时
  return {
    content: [{ type: 'text', text: 'Execution timed out' }],
    isError: true
  };
}

function extractQoR(output) {
  // 使用正则提取时序指标
  const wnsMatch = output.match(/WNS[:\s]+([-\d.]+)\s*ns/i);
  const tnsMatch = output.match(/TNS[:\s]+([-\d.]+)\s*ns/i);

  return {
    wns: wnsMatch ? parseFloat(wnsMatch[1]) : null,
    tns: tnsMatch ? parseFloat(tnsMatch[1]) : null,
    extracted: !!(wnsMatch && tnsMatch)
  };
}
```

#### 4. 服务器启动

```javascript
// servers/eda/index.js - 第 250-270 行

async function main() {
  // 创建传输（stdin/stdout）
  const transport = new StdioServerTransport();

  // 将服务器连接到传输
  await server.connect(transport);

  // 记录到 stderr（stdout 用于 MCP 协议）
  console.error('HiPilot EDA MCP Server running on stdio');
}

main().catch(console.error);
```

### FlowCertifier（src/hitestbot/core/FlowCertifier.js）

这是测试框架——使用 HiPilot 的"虚拟人类"。

#### 关键概念：观察点

```javascript
// src/hitestbot/core/FlowCertifier.js - 简化

class FlowCertifier {
  constructor(options) {
    this.session = options.session || 'hipilot';
    this.socket = options.socket || 'hipilot';
    this.evidenceDir = options.evidenceDir;
    this.observations = [];
  }

  // 捕获两个窗格的快照
  async captureObservation(label) {
    // 捕获 Claude 窗格（左）
    const claudeOutput = execSync(
      `tmux -L ${this.socket} capture-pane -p -t ${this.socket}:0.0`
    );

    // 捕获 EDA 窗格（右）
    const edaOutput = execSync(
      `tmux -L ${this.socket} capture-pane -p -t ${this.socket}:0.1`
    );

    // 截图
    execSync(`import -window root ${this.evidenceDir}/obs_${label}.png`);

    // 保存日志
    writeFileSync(
      `${this.evidenceDir}/obs_${label}_claude.log`,
      claudeOutput
    );
    writeFileSync(
      `${this.evidenceDir}/obs_${label}_eda.log`,
      edaOutput
    );

    return { claude: claudeOutput, eda: edaOutput };
  }

  // 主测试循环
  async runFlow(command) {
    // 1. 启动 HiPilot
    await this.launchHiPilot();

    // 2. 等待 Claude 就绪
    await this.waitForClaudeReady();

    // 3. 输入命令
    await this.typeCommand(command);

    // 4. 观察和监控
    await this.watchFlow();

    // 5. 评分结果
    return this.scoreResult();
  }

  // 评分引擎（L1-L5）
  scoreResult() {
    const before = this.observations[0];
    const after = this.observations[this.observations.length - 1];

    return {
      L1: this.scoreL1(before, after),
      L2: this.scoreL2(after),
      L3: this.scoreL3(after),
      L4: this.scoreL4(after),
      L5: this.scoreL5(after)
    };
  }

  // L5：QoR 评估（关键的一个）
  scoreL5(observation) {
    const claudeOutput = observation.claude;

    // 查找明确的 WNS/TNS 数字
    const wnsMatch = claudeOutput.match(/WNS[:\s]+([-\d.]+)\s*ns/i);
    const tnsMatch = claudeOutput.match(/TNS[:\s]+([-\d.]+)\s*ns/i);

    if (wnsMatch && tnsMatch) {
      return {
        score: 1.0,
        detail: `WNS=${wnsMatch[1]}ns, TNS=${tnsMatch[1]}ns`
      };
    }

    if (wnsMatch || tnsMatch) {
      return { score: 0.5, detail: 'Partial QoR' };
    }

    return { score: 0.0, detail: 'No QoR reported' };
  }
}
```

---

## 第7章 构建你的第一个扩展

### 练习：添加功耗分析能力

让我们构建一个完整的扩展，为 HiPilot 添加功耗分析。

#### 步骤1：创建技能

创建 `skills/power-analysis-expert.md`：

```markdown
---
name: power-analysis-expert
description: |
  分析功耗并建议优化。
  涵盖动态功耗、漏电和时钟门控效率。
version: "1.0.0"
---

# 功耗分析专家

## 何时使用

- 布局或布线后进行功耗估计
- 当功耗超出预算时
- 用于时钟门控效率审查

## 分析流程

### 阶段1：数据收集

```tcl
# 生成功耗报告
report_power -outfile power_summary.rpt
report_power -hier -outfile power_hierarchical.rpt
report_clock_gating -outfile clock_gating.rpt

# 提取关键指标
set total_power [get_metric power.total]
set dynamic_power [get_metric power.dynamic]
set leakage_power [get_metric power.leakage]
set cg_efficiency [get_metric clock_gating.efficiency]

puts "Total Power: ${total_power} mW"
puts "Dynamic: ${dynamic_power} mW ([expr $dynamic_power/$total_power*100]%)"
puts "Leakage: ${leakage_power} mW ([expr $leakage_power/$total_power*100]%)"
puts "CG Efficiency: ${cg_efficiency}%"
```

### 阶段2：分析和建议

**如果动态功耗 > 总功耗的 70%：**
- 高开关活动
- 建议：活动分析、时钟门控改进

**如果漏电 > 总功耗的 40%：**
- 技术或低功耗模式问题
- 建议：HVT 单元交换、电源门控

**如果时钟门控效率 < 85%：**
- 门控机会被错过
- 建议：审查使能条件、添加门控器

### 阶段3：报告生成

格式：
```
📊 功耗分析报告

总功耗：XXX mW
├── 动态：XXX mW (XX%)
├── 漏电：XXX mW (XX%)
└── 时钟：XXX mW (XX%)

时钟门控效率：XX%

建议：
1. [基于分析的具体建议]
2. [另一个建议]
```
```

#### 步骤2：创建模板

创建 `templates/cadence/report_power.tcl`：

```tcl
{# 功耗分析模板 #}
{# 用法：全面的功耗报告 #}

{# 基本功耗报告 #}
report_power -outfile {{ output_dir }}/power_summary.rpt

{# 层次分解 #}
{% if hierarchical %}
report_power -hier -outfile {{ output_dir }}/power_hier.rpt
{% endif %}

{# 时钟门控分析 #}
{% if analyze_clock_gating %}
report_clock_gating -outfile {{ output_dir }}/clock_gating.rpt
{% endif %}

{# 高功耗网络的活动分析 #}
{% if activity_analysis %}
report_switching_activity -outfile {{ output_dir }}/activity.rpt
{% endif %}
```

#### 步骤3：测试它

```bash
# 部署到 EDA 服务器
node src/hitestbot/infra/deploy_hipilot.js

# 用 HiTestBot 测试
bin/hitestbot-eda "analyze power consumption"
```

#### 步骤4：分析证据

检查 `test-evidence/latest/`：
- AI 加载技能了吗？
- 它调用了正确的 MCP 工具吗？
- 它正确格式化报告了吗？

#### 步骤5：迭代

基于证据，改进：
- 澄清模糊的指令
- 添加错误处理
- 改进报告格式

---

## 附录A：JavaScript 快速参考

### 变量
```javascript
let x = 5;              // 可变
const y = 10;           // 不可变
var z = 15;             // 旧风格（避免）
```

### 函数
```javascript
// 声明
function add(a, b) { return a + b; }

// 箭头函数
const add = (a, b) => a + b;

// 异步函数
async function fetchData() { ... }
```

### 数组
```javascript
let arr = [1, 2, 3];
arr.push(4);            // 添加到末尾
arr.pop();              // 从末尾移除
arr.filter(x => x > 1); // [2, 3]
arr.map(x => x * 2);    // [2, 4, 6]
```

### 对象
```javascript
let obj = { a: 1, b: 2 };
obj.a;                  // 1
obj['b'];               // 2
obj.c = 3;              // 添加属性
```

### Async/Await
```javascript
async function main() {
  const result = await someAsyncOperation();
  console.log(result);
}
```

## 附录B：MCP 工具参考

| 工具 | 用途 | 示例用法 |
|------|------|----------|
| `eda.detect_tool` | 检查 EDA 工具是否运行 | 开始工作前 |
| `eda.start_tool` | 启动 Innovus/ICC2 | 未检测到工具时 |
| `eda.execute_and_verify` | 运行 Tcl 并检查 | 每个阶段执行 |
| `eda.diagnose_error` | 获取错误分析 | 发生错误时 |
| `eda.generate_tcl` | 使用模板 | 用于标准报告 |
| `knowledge.get_skill` | 加载技能 | 流程开始时 |
| `qor.snapshot` | 保存指标 | 每个阶段后 |

## 附录C：开发工作流

```
1. 定义成功标准
   ↓
2. 编写技能（向新毕业生解释）
   ↓
3. 创建模板（如果需要）
   ↓
4. 用 HiTestBot 测试
   ↓
5. 分析证据
   ↓
6. 改进
   ↓
7. 重复 4-6 直到满意
```

---

## 第8章 LittleBrain——基于知识的编排

LittleBrain 是 HiPilot 的"小脑"——一个基于知识的编排层，像一个专门用于 EDA 任务的专用 LLM。它提供结构化推理、Tcl 生成和自我改进能力。

### 为什么需要 LittleBrain？

传统的 AI 智能体完全依赖 LLM 的上下文窗口进行推理。LittleBrain 增加了：

1. **结构化知识** — 使用 PageIndex 树导航而非向量相似性
2. **活动日志** — 所有推理步骤的完整审计跟踪
3. **自我改进** — 从错误和成功模式中学习
4. **Tcl 生成** — 带有验证功能的专用生成器

### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    LittleBrain 层                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Tcl 生成器   │  │  输出解析器  │  │    编排器       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │   自我改进       │  │           日志                 │  │
│  │  - 错误模式 DB   │  │  - 推理步骤                    │  │
│  │  - 成功跟踪器    │  │  - 决策                        │  │
│  └──────────────────┘  │  - Tcl 生成                    │  │
│                        └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 组件

| 组件 | 用途 | 位置 |
|------|------|------|
| `index.js` | LittleBrain 主类，统一接口 | `servers/knowledge/littlebrain/` |
| `tcl-generator.js` | 从自然语言意图生成 Tcl | `servers/knowledge/littlebrain/` |
| `output-parser.js` | 解析 EDA 输出，提取错误/QoR | `servers/knowledge/littlebrain/` |
| `orchestrator.js` | 阶段定义、流程上下文、先决条件 | `servers/knowledge/` |
| `self-improvement.js` | 错误模式 DB、成功跟踪 | `servers/knowledge/littlebrain/` |
| `logger.js` | 活动日志，用于审计 | `servers/knowledge/littlebrain/` |

### PageIndex：基于树的知识

与使用嵌入的向量 RAG 不同，PageIndex 使用文档结构：

```
INNOVUS/
├── Design_Init/
│   ├── init_design
│   └── MMMC 设置
├── Floorplanning/
│   ├── floorPlan
│   └── loadIoFile
├── Power_Planning/
│   ├── globalNetConnect
│   └── addStripe
└── ...
```

**为什么这对 EDA 很重要：**
- `report_timing` 和 `report_power` 等命令语义相似但用于不同阶段
- 向量相似性会失败——你需要关于工具上下文和流程阶段的推理
- 树导航提供确定性检索

### 活动日志

每个推理步骤都被记录用于审计：

```javascript
// 示例：Tcl 生成日志
logger.logTclGeneration({
  intent: '修复建立时序违规',
  tool: 'innovus',
  stage: 'post_route',
  generatedTcl: '...',
  confidence: 0.92,
  timestamp: '2026-03-09T08:57:25Z'
});
```

日志类别：
- `reasoning` — 决策过程
- `decision` — 最终选择
- `tcl_generation` — 创建的 Tcl 脚本
- `output_parsing` — 工具输出分析
- `stage_planning` — 流程编排
- `error_pattern_matching` — 错误分类

### 自我改进

LittleBrain 跟踪模式以随时间改进：

```javascript
// ErrorPatternDB 从失败中学习
errorPatternDB.addPattern({
  errorSignature: 'layer.*referenced in pin.*macro',
  category: 'LEF_LOADING',
  severity: 'CRITICAL',
  fixStrategy: '先加载 tech LEF，再加载 cell LEF',
  confidence: 1.0
});

// SuccessTracker 记录有效的方法
successTracker.record({
  stage: 'placement',
  commandSequence: ['setPlaceMode', 'place_opt_design'],
  qor: { wns: 0.0, tns: 0.0 },
  context: { design: 'ibex', util: 0.7 }
});
```

### 使用 LittleBrain

LittleBrain 通过知识 MCP 服务器自动集成：

```javascript
// 获取带有 LittleBrain 增强上下文的技能
const skill = await knowledge.get_skill({
  name: 'fix-setup-timing',
  use_littlebrain: true  // 启用增强推理
});

// 生成的 Tcl 包含基于错误模式的自动修复
const tcl = await littlebrain.generateTcl({
  intent: '修复 post-route 中的建立违规',
  tool: 'innovus',
  stage: 'post_route',
  context: { currentWns: -0.05 }
});
```

---

## 第9章 认证与测试结果

HiPilot 使用 HiTestBot——一个虚拟人类测试器——来验证行为。6 层评分系统测量：

| 层级 | 指标 | 描述 |
|------|------|------|
| L1 | 提示交付 | Claude 是否响应？ |
| L2 | 意图识别 | 它是否理解任务？ |
| L3 | MCP 工具使用 | 它是否正确使用工具？ |
| L3b | 流程验证 | 它是否使用正确的 EDA 工具？ |
| L4 | EDA 执行 | EDA 工具是否成功运行？ |
| L5 | QoR 评估 | 它是否报告质量指标？ |

### 最新测试结果（2025年3月9日）

**测试运行：** 2026-03-09 08:57:25
**命令：** `/rtl2gds`
**持续时间：** 1202.8秒（20分钟）
**分支：** `dev/environment-setup-7005`

| 层级 | 分数 | 状态 | 备注 |
|------|------|------|------|
| **L1 提示交付** | 1.0/1.0 | ✅ | Claude 响应了 |
| **L2 意图识别** | 1.0/1.0 | ✅ | 理解 RTL-to-GDS 流程 |
| **L3 MCP 工具使用** | 1.0/1.0 | ✅ | 6,839 次 MCP 调用 |
| **L3b 流程验证** | 1.0/1.0 | ✅ | 正确使用 dc_shell |
| **L4 EDA 执行** | 0.0/1.0 | ❌ | LEF 文件加载错误 |
| **L5 QoR 评估** | 1.0/1.0 | ✅ | WNS=0.00, TNS=0.00 |

**总分：5.0/6.0（83%）**
**GPA：3.37/4.0（B）**
**类人度：100%**（从 30% 提升）

### 关键成就：类人度 100%

类人行为分数从 **30%（机器样）** 提升到 **100%（类人）**，通过：

- **增量交互模式** — 一次发送一个命令
- **类人等待** — 使用 `eda.await_idle` 而非轮询
- **观察后再继续** — 读取工具输出后再执行下一步
- **自然输入模式** — 避免批量 Tcl 提交

### L4 失败分析

EDA 执行失败是由于 **PDK/环境问题**，而非 AI 行为问题：

```
**ERROR: (IMPLF-53): The layer 'li1' referenced in pin 'VGND' in macro 'sky130_ef_sc_hd__decap_12'
**ERROR: Loading LEF file(s) failed
```

**根本原因：** EDA 服务器上 LEF 文件加载顺序错误。技术 LEF（`sky130_fd_sc_hd.tlef`）必须在 cell LEF 之前加载。

**类别：** 环境（非 AI 行为问题）

### 证据包

每次测试生成全面的证据：

| 文件 | 描述 | 大小 |
|------|------|------|
| `FLOW_REPORT.md` | 完整认证报告 | 23KB |
| `stage_scorecards.json` | 每阶段分数和详情 | 3KB |
| `flow_progress.json` | 流程进度图 | 3KB |
| `timeline.jsonl` | 带时间戳的时序事件日志 | 1.5MB |
| `run_log.txt` | 测试执行日志 | 13KB |
| `recordings/test_recording.mp4` | 完整视频录制 | 56MB |
| 截图 | 20+ 观察点图片 | ~5MB |

时间线包含视频时间戳——每个事件都可以通过跳转到录制中的确切时刻来验证。

### 通往 6.0/6.0 的路径

为了实现完全认证：

1. **修复 EDA 服务器上的 PDK 问题** — 更正 LEF 加载顺序
2. **重新运行认证测试**
3. **验证 L4 通过** — EDA 工具无 LEF 错误运行

AI 行为（L1-L3, L3b, L5）已经达到 100%。只需要修复环境。

---

## 结论：你已准备好

你现在理解：
- ✅ **智能体架构**（三层、状态机）
- ✅ **JavaScript**（AI 开发的语言）
- ✅ **MCP**（将所有东西绑定在一起的协议）
- ✅ **技能**（编码 RTL2GDS 专业知识）
- ✅ **代码库**（HiPilot 实际工作原理）
- ✅ **扩展模式**（如何添加能力）
- ✅ **LittleBrain**（基于知识的编排）
- ✅ **认证**（HiTestBot 评分方法）

**你的 ASIC 知识是差异化因素。** AI 提供推理。你提供方法论。

**开始构建：**
1. 选择一个你经常做的任务
2. 把它写成技能
3. 用 HiTestBot 测试
4. 基于证据迭代

*芯片设计的未来是 AI 辅助的。你现在已装备好构建它。* 🚀

---

**资源：**
- HiPilot：`/home/EDA/hipilot/current/`
- 这本手册：`docs/AI_ASIC_COOKBOOK_CN.md`
- MCP SDK：https://github.com/modelcontextprotocol
- JavaScript 指南：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript
