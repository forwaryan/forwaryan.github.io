---
title: "TinyKV Lab3：Multi-RaftKV"
date: "2026-06-02 10:03:00"
updated: "2026-06-02 11:30:00"
permalink: "2026/06/02/tinykv-lab3-multiraftkv/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "分布式系统"
  - "Raft"
  - "Multi-Raft"
  - "Region"
---

> 来源：本地 TinyKV 项目文件：`tinykv-understanding/labs/lab3-multiraftkv.md`。
> 顺序：[MIT 6.5840 和 TinyKV](/2026/06/01/mit65840-tinykv-distributed-storage/) / [Lab1](/2026/06/02/tinykv-lab1-standalonekv/) / [Lab2](/2026/06/02/tinykv-lab2-raftkv/) / [Lab3](/2026/06/02/tinykv-lab3-multiraftkv/) / [Lab3B](/2026/06/02/tinykv-lab3b-region-split-state-convergence/) / [Lab4](/2026/06/02/tinykv-lab4-transactions/) / [面经索引](/2026/06/02/tinykv-interview-experience-index/)。

<figure class="tinykv-svg-figure">
  <a href="/images/posts/tinykv-labs/tinykv-lab3-region-peer-store.svg" target="_blank" rel="noopener"><img src="/images/posts/tinykv-labs/tinykv-lab3-region-peer-store.svg" alt="TinyKV Lab3 Store Peer Region 关系"></a>
  <figcaption>Store、Peer、Region 和 Scheduler 的关系。</figcaption>
</figure>

Lab3 开始才真正像一个分布式存储系统。单个 Raft group 只能让数据更可靠，不能让容量和吞吐横向扩展；Region 和 Multi-Raft 解决的是“把不同 key range 分给不同 Raft group”这件事。

官方页面：https://yunpengn.github.io/tinykv/doc/project3-MultiRaftKV.html

## 一句话

Lab3 要把“一个 Raft 组管理全部 key”，升级成“多个 Raft 组分别管理不同 key 范围”。

Lab2 是：

```text
全部 key -> 一个 Region -> 一个 Raft 组
```

Lab3 变成：

```text
[a, h) -> Region 1 -> Raft 组 1
[h, p) -> Region 2 -> Raft 组 2
[p, z) -> Region 3 -> Raft 组 3
```

这样数据量大了以后，就可以把不同范围的数据分摊到不同节点上。

从 Lab2 到 Lab3，可以先看这张图：

{% mermaid %}
graph LR
    subgraph Lab2["Lab2：单 Raft 组"]
        AllKeys["全部 key<br/>[空, 空)"] --> OneRegion["Region 1"]
        OneRegion --> OneRaft["一个 Raft 组"]
    end

    subgraph Lab3["Lab3：Multi-Raft"]
        R1["Region 1<br/>[空, h)"] --> G1["Raft 组 1"]
        R2["Region 2<br/>[h, p)"] --> G2["Raft 组 2"]
        R3["Region 3<br/>[p, 空)"] --> G3["Raft 组 3"]
    end

    OneRaft --> R1
    OneRaft --> R2
    OneRaft --> R3
{% endmermaid %}

Lab3 的目标不是“把 Raft 换掉”，而是让系统里同时跑很多个 Raft 组。每个 Raft 组只负责一段 key。

<!-- more -->

## 先把三个词搞清楚

Lab3 最容易卡住的是 `Store`、`Peer`、`Region` 这三个词。先不用管源码，可以先这样记：

| 词 | 大白话 |
|---|---|
| `Store` | 一台存储机器，或者一个 TinyKV 存储进程 |
| `Region` | 一个分片，也就是一段连续的 key 范围 |
| `Peer` | 某个 Region 在某个 Store 上的一份副本 |

比如 `Region 1` 管 `[a, m)` 这段 key。为了高可用，它不会只存在一台机器上，而是会复制到多台 `Store` 上：

```text
Region 1: [a, m)

Peer 1 在 Store 1
Peer 2 在 Store 2
Peer 3 在 Store 3
```

这三个 Peer 保存的是同一个 Region 的三份副本，它们组成一个 Raft 组。

{% mermaid %}
graph TB
    R1["Region 1<br/>key range: [a, m)"]
    R1 --> P1["Peer 1<br/>on Store 1"]
    R1 --> P2["Peer 2<br/>on Store 2"]
    R1 --> P3["Peer 3<br/>on Store 3"]

    P1 --- RG["Region 1 的 Raft 组"]
    P2 --- RG
    P3 --- RG
{% endmermaid %}

所以不要把 `Peer` 理解成一台机器。更准确是：

```text
Store 是机器 / 进程级别。
Peer 是数据副本级别。
```

一个 Store 上可以有很多 Peer，因为一台机器可以承载很多分片副本：

```text
Store 1:
  Region 1 的 Peer
  Region 2 的 Peer
  Region 5 的 Peer

Store 2:
  Region 1 的 Peer
  Region 3 的 Peer
  Region 6 的 Peer
```

横着看：

```text
Region 1 的多个 Peer -> 一个 Raft 组
```

竖着看：

```text
Store 1 上有很多不同 Region 的 Peer
```

可以用这张表理解：

| | Store 1 | Store 2 | Store 3 |
|---|---|---|---|
| Region 1 | Peer 1 | Peer 2 | Peer 3 |
| Region 2 | Peer 4 | Peer 5 | Peer 6 |
| Region 3 | Peer 7 | Peer 8 | Peer 9 |

Lab3 叫 Multi-Raft，就是因为系统里会同时有很多 Region，而每个 Region 背后都有一个自己的 Raft 组。

这张图把“横着看”和“竖着看”画出来：

{% mermaid %}
graph TB
    subgraph S1["Store 1"]
        P11["R1-Peer1"]
        P21["R2-Peer4"]
        P31["R3-Peer7"]
    end

    subgraph S2["Store 2"]
        P12["R1-Peer2"]
        P22["R2-Peer5"]
        P32["R3-Peer8"]
    end

    subgraph S3["Store 3"]
        P13["R1-Peer3"]
        P23["R2-Peer6"]
        P33["R3-Peer9"]
    end

    P11 --- R1G["Region 1 的 Raft 组<br/>[a, h)"]
    P12 --- R1G
    P13 --- R1G

    P21 --- R2G["Region 2 的 Raft 组<br/>[h, p)"]
    P22 --- R2G
    P23 --- R2G

    P31 --- R3G["Region 3 的 Raft 组<br/>[p, z)"]
    P32 --- R3G
    P33 --- R3G
{% endmermaid %}

这张图很关键：

```text
横向：同一个 Region 的多个 Peer 组成一个 Raft 组。
纵向：同一个 Store 上承载很多不同 Region 的 Peer。
```

## Lab3 分成三部分

| 部分 | 要做什么 | 白话解释 |
|---|---|---|
| A 部分 | Raft 成员变更和主节点转移 | Raft 组可以加副本、删副本、换主节点 |
| B 部分 | raftstore 支持管理命令和 Region 分裂 | 让 TinyKV 真正能改副本、拆 Region |
| C 部分 | 调度器 | 调度器观察集群，然后告诉节点搬副本 |

对应到测试命令：

| 命令 | 所属阶段 | 要证明什么 |
|---|---|---|
| `make project3a` | Lab3A | Raft 模块支持 conf change 和 leader transfer |
| `make project3b` | Lab3B | raftstore 能执行 ChangePeer、TransferLeader、Split，并维护 Region 元信息 |
| `make project3c` | Lab3C | scheduler 能处理 Region heartbeat，并生成 balance-region operator |
| `make project3` | Lab3 全部 | A/B/C 全部通过 |

## 当前完成状态

目前本地 Lab3 已经结束，可以按下面这张表理解进度：

| 阶段 | 状态 | 我们完成了什么 | 对应提交 |
|---|---|---|---|
| Lab3A | 已完成 | Raft 层支持加 Peer、删 Peer、Leader Transfer | `7b6e8f2` |
| Lab3B | 已完成并修复重点偶发失败 | raftstore 能执行 `ChangePeer`、`TransferLeader`、`Split`，并修复 split 后状态收敛问题 | `c67dcc9`、`7906b84` |
| Lab3C | 已完成 | scheduler 能处理 Region heartbeat，并生成 balance region operator | `b606973` |

最近一次本地完整回归里，`make project3` 已通过。由于 `project3b` 里的子测试也带有 `|| true`，验证时除了看命令结束状态，还扫了完整日志，确认没有 `FAIL`、`panic`、`fatal error`。

如果用一句话总结：

```text
Lab3A 让一个 Raft 组能改成员。
Lab3B 让 raftstore 真正用这些能力修改 Region。
Lab3C 让 scheduler 站在全局视角决定什么时候搬 Region。
```

本地讨论里 Lab3 最值得记住的是这条主线：

```text
Lab2 已经能复制一个 Region 的日志。
Lab3A 让这个 Region 的副本集合可以变化。
Lab3B 让 Region 可以被 split 成两个范围。
Lab3C 让 scheduler 根据 heartbeat 决定副本怎么搬。
```

也就是说，Lab3 不是重新做一个 KV，而是在 Lab2 的 RaftKV 上补齐“多 Region 管理能力”。

## A 部分：Raft 组成员变化

Lab2 里可以先理解成：一个 Raft 组的成员基本固定。Lab3 开始要支持动态变化。

这部分说白了就是：

```text
一个分片 Region 内部，
哪些 Store 上有这个 Region 的副本，
以及哪个 Peer 当 leader，
都可以动态调整。
```

要做三类事情：

| 能力 | 白话解释 |
|---|---|
| 加副本 | 给某个 Region 增加一个新 Peer |
| 删副本 | 从某个 Region 移除一个 Peer |
| 转移主节点 | 把某个 Region 的 leader 主动交给另一个 Peer |

为什么需要？

```text
节点太满了，要把副本搬出去。
节点下线了，要把它的副本删掉。
主节点压力太大了，要把主节点换到别的节点。
```

从实现角度看，`ChangePeer` 不是某台机器自己偷偷改本地配置。它也要先进入 Raft，等多数副本同意后才能真正生效：

{% mermaid %}
graph TB
    Req["AdminRequest<br/>ChangePeer"] --> Leader["Region leader<br/>ProposeConfChange"]
    Leader --> Entry["Raft log<br/>EntryConfChange"]
    Entry --> Replicate["复制到多数 Peer"]
    Replicate --> Commit["commit"]
    Commit --> Meta["更新 RegionLocalState<br/>Peers 变化<br/>conf_ver++"]
    Meta --> Apply["RawNode.ApplyConfChange"]

    Apply --> AddBranch{"AddNode 还是 RemoveNode?"}
    AddBranch -->|AddNode| Add["新 Store 收到 heartbeat<br/>maybeCreatePeer"]
    Add --> Catch["通过 snapshot / log<br/>追上数据"]

    AddBranch -->|RemoveNode| Remove["移出 Peer 列表"]
    Remove --> Destroy["destroyPeer<br/>停止这个 Peer"]
{% endmermaid %}

这张图说明了一个关键点：

```text
Region 的副本集合也是一致性状态。
不能只在 leader 本地改，必须通过 Raft 提交后再改。
```

举个例子，原来 `Region 1` 有三个副本：

```text
Region 1:
  Peer 1 on Store 1
  Peer 2 on Store 2
  Peer 3 on Store 3
```

如果集群新加了 `Store 4`，想让它也保存 `Region 1` 的副本，就可以加一个 Peer：

```text
Region 1:
  Peer 1 on Store 1
  Peer 2 on Store 2
  Peer 3 on Store 3
  Peer 4 on Store 4
```

如果 `Store 2` 要下线，就可以删掉 `Region 1` 在 `Store 2` 上的 Peer：

```text
Region 1:
  Peer 1 on Store 1
  Peer 3 on Store 3
  Peer 4 on Store 4
```

这里不是说 `Store 2` 这台机器一定从集群里消失了，而是说：

```text
Store 2 不再保存 Region 1 这个分片的数据副本。
```

leader transfer 也是同一个思路。比如 leader 原来在 `Store 1`：

```text
Region 1:
  Peer 1 on Store 1  <- leader
  Peer 2 on Store 2
  Peer 3 on Store 3
```

如果 `Store 1` 太忙，可以把 leader 转给 `Store 3`：

```text
Region 1:
  Peer 1 on Store 1
  Peer 2 on Store 2
  Peer 3 on Store 3  <- leader
```

这不会搬数据，只是换谁来当这个 Region 的主节点。

把 add/remove peer 画成流程就是：

{% mermaid %}
graph LR
    subgraph Before["变更前"]
        B1["Peer 1<br/>Store 1"]
        B2["Peer 2<br/>Store 2"]
        B3["Peer 3<br/>Store 3"]
    end

    Before --> Add["AddPeer<br/>在 Store 4 加 Peer 4"]

    subgraph AfterAdd["加副本后"]
        A1["Peer 1<br/>Store 1"]
        A2["Peer 2<br/>Store 2"]
        A3["Peer 3<br/>Store 3"]
        A4["Peer 4<br/>Store 4"]
    end

    Add --> AfterAdd
    AfterAdd --> Remove["RemovePeer<br/>删除 Store 2 上的 Peer 2"]

    subgraph AfterRemove["删副本后"]
        R1["Peer 1<br/>Store 1"]
        R3["Peer 3<br/>Store 3"]
        R4["Peer 4<br/>Store 4"]
    end

    Remove --> AfterRemove
{% endmermaid %}

上面这张图看的是副本分布变化。落到执行细节上，`AddNode` 和 `RemoveNode` 的 apply 动作不一样：

{% mermaid %}
graph TB
    A1["AddNode 提交后"] --> A2["Region.Peers 加入新 Peer"]
    A2 --> A3["新 Peer 由 raftstore 创建"]
    A3 --> A4["通过日志或 snapshot 追上数据"]

    R1["RemoveNode 提交后"] --> R2["Region.Peers 删除旧 Peer"]
    R2 --> R3{"删的是本机 Peer？"}
    R3 -- "是" --> R4["destroyPeer<br/>停止本地 Raft 模块"]
    R3 -- "否" --> R5["只更新本地元信息"]
{% endmermaid %}

新增 Peer 的重点是“先加入，再追数据”；删除 Peer 的重点是“先提交删除，再停掉被删 Peer”。这样每个节点看到的副本集合变化顺序是一致的。

Leader transfer 画出来是：

{% mermaid %}
graph LR
    subgraph BeforeLT["转移前"]
        L1["Peer 1<br/>Store 1<br/>leader"]
        F2["Peer 2<br/>Store 2<br/>follower"]
        F3["Peer 3<br/>Store 3<br/>follower"]
    end

    BeforeLT --> Transfer["TransferLeader<br/>目标：Peer 3"]

    subgraph AfterLT["转移后"]
        F1["Peer 1<br/>Store 1<br/>follower"]
        F22["Peer 2<br/>Store 2<br/>follower"]
        L3["Peer 3<br/>Store 3<br/>leader"]
    end

    Transfer --> AfterLT
{% endmermaid %}

上面这张图只画了“谁当 leader”的结果。真实消息流程更像一次被指定目标的选举：旧 leader 先帮目标 Peer 补齐日志，然后让它立刻竞选。

{% mermaid %}
sequenceDiagram
    participant L as 当前 leader
    participant T as 目标 Peer
    participant O as 其他 Peer

    L->>T: 如果日志落后，先发送 MsgAppend
    L->>L: 暂停新的普通 proposal
    L->>T: MsgTimeoutNow
    T->>T: 立刻触发选举
    T->>O: RequestVote
    O-->>T: 投票
    T-->>L: 成为新的 leader
{% endmermaid %}

记住一句话就行：leader transfer 不搬数据、不改 Peer 列表，所以不会增加 `conf_ver`；它只是把同一个 Region 的 leader 换到另一个 Peer 上。

Lab3A 主要改 Raft 层：

| 文件 | 主要任务 |
|---|---|
| `raft/raft.go` | 处理 `MsgTransferLeader`、`MsgTimeoutNow`，实现 `addNode`、`removeNode`，成员变化后更新 `Prs` |
| `raft/rawnode.go` | 实现 `ProposeConfChange`、`ApplyConfChange`、`TransferLeader` 这些给上层调用的接口 |
| `proto/proto/eraftpb.proto` | 通常只需要理解已有消息和结构，不建议随便改协议 |

这部分只是让 Raft 算法“具备能力”，真正把 Region 元信息改掉是在 Lab3B。

我们本地完成 Lab3A 时，最重要的是补上这几条链路：

| 链路 | 作用 |
|---|---|
| `ProposeConfChange -> EntryConfChange -> ApplyConfChange` | 让成员变化先进入 Raft log，再统一 apply |
| `addNode/removeNode` | 真正修改 Raft 内部的 `Prs` 成员表 |
| `TransferLeader -> MsgTimeoutNow` | 让旧 leader 指定某个 follower 尽快发起选举 |

这里要注意：Lab3A 只负责 Raft 内部成员表和 leader transfer，不直接改 Region 的 key range，也不直接创建/销毁 raftstore peer。那些动作放在 Lab3B。

## B 部分：Region 分裂

一个 Region 太大时，要拆成两个 Region。

例子：

```text
拆分前：
Region 1 管 [a, z)

按 m 拆分后：
Region 1 管 [a, m)
Region 2 管 [m, z)
```

这样原来一个 Raft 组承受的压力，就可以逐渐分散到多个 Raft 组。

为什么要拆？

```text
一个 Region 太大：
  数据太多
  请求太多
  一个 Raft 组压力太大
  迁移成本也高

拆成多个 Region 后：
  不同 key 范围可以独立复制
  可以独立调度
  也可以独立承载请求
```

比如：

```text
key = apple  -> Region 1: [a, m)
key = user99 -> Region 2: [m, z)
```

分裂后，每个 Region 都有自己的 Peer 和 Raft 组：

```text
Region 1:
  Peer 1 on Store 1
  Peer 2 on Store 2
  Peer 3 on Store 3

Region 2:
  Peer 4 on Store 1
  Peer 5 on Store 2
  Peer 6 on Store 3
```

注意：两个 Region 可以先落在同一批 Store 上，后面再由调度器慢慢搬到更合适的位置。

Region split 可以画成这样：

{% mermaid %}
graph TB
    subgraph BeforeSplit["Split 前"]
        BR["Region 1<br/>range: [a, z)<br/>Raft 组 1"]
        BP1["Peer 1<br/>Store 1"]
        BP2["Peer 2<br/>Store 2"]
        BP3["Peer 3<br/>Store 3"]
        BP1 --- BR
        BP2 --- BR
        BP3 --- BR
    end

    BeforeSplit --> SplitKey["按 split key = m 拆开"]

    subgraph AfterSplit["Split 后"]
        AR1["Region 1<br/>range: [a, m)<br/>Raft 组 1"]
        AR2["Region 2<br/>range: [m, z)<br/>Raft 组 2"]

        AP1["Peer 1<br/>Store 1"]
        AP2["Peer 2<br/>Store 2"]
        AP3["Peer 3<br/>Store 3"]
        AP4["Peer 4<br/>Store 1"]
        AP5["Peer 5<br/>Store 2"]
        AP6["Peer 6<br/>Store 3"]

        AP1 --- AR1
        AP2 --- AR1
        AP3 --- AR1

        AP4 --- AR2
        AP5 --- AR2
        AP6 --- AR2
    end

    SplitKey --> AfterSplit
{% endmermaid %}

这里容易误解的一点是：split 不是把所有数据立刻跨机器搬一遍。TinyKV 用的是 range 分片，很多时候主要是改 Region 元信息：

```text
原来一个 Region 负责 [a, z)
现在两个 Region 分别负责 [a, m) 和 [m, z)
```

这部分还要让 raftstore 能处理管理命令，比如：

```text
转移主节点
增加副本
删除副本
分裂 Region
```

这些管理命令也要走 Raft。原因很简单：Region 的元信息也必须在多数副本之间保持一致。

Split 在代码里的大致链路是：

{% mermaid %}
sequenceDiagram
    participant Checker as split checker
    participant Peer as peerMsgHandler
    participant Sch as Scheduler
    participant Raft as Raft
    participant Meta as StoreMeta / router

    Checker->>Peer: 发现 Region 太大<br/>产生 split key
    Peer->>Sch: AskSplit<br/>申请新 Region ID 和新 Peer IDs
    Sch-->>Peer: 返回 newRegionID + newPeerIDs
    Peer->>Raft: propose AdminRequest(Split)
    Raft-->>Peer: Split entry committed
    Peer->>Meta: apply split<br/>更新旧 Region range/version
    Peer->>Meta: 创建新 Region<br/>注册新 Peer / regionRanges
{% endmermaid %}

这张图里要抓住两点：

```text
1. 新 Region 和新 Peer 的 ID 需要向 Scheduler 申请，不能本地随便编。
2. Split 最终也要作为 Raft admin command 提交，提交后才更新 Region 元信息。
```

Lab3B 主要改 raftstore：

| 文件 | 主要任务 |
|---|---|
| `kv/raftstore/peer_msg_handler.go` | propose/apply admin command：`TransferLeader`、`ChangePeer`、`Split` |
| `kv/raftstore/peer.go` | 创建新 Peer、destroy 被移除 Peer、维护 callback 和 Peer 状态 |
| `kv/raftstore/router.go` | 理解多个 Region/Peer 如何路由消息，通常更多是读懂框架 |
| `kv/raftstore/runner/split_check.go` | 理解 split key 如何产生，通常框架已给出 |

这部分的核心不是“复制 value”，而是让 Region 的范围、Peer 列表、RegionEpoch、storeMeta、router 注册关系都在 Raft 提交后一起变正确。

我们本地完成 Lab3B 时，实际补的是这些关键点：

| 功能 | 容易理解的说法 |
|---|---|
| `ChangePeer` | 收到 scheduler 的加/删 Peer 命令后，把它作为 Raft admin log 提交，再更新 Region 的 Peer 列表 |
| `TransferLeader` | 收到转主命令后，让当前 leader 把 leader 位置交给目标 Peer |
| `Split` | 一个 Region 太大时，向 scheduler 申请新 ID，然后把旧 Region 拆成 left/right 两段 |
| `storeMeta` / `router` 更新 | 本地内存里的 Region 路由表也要同步更新，否则请求会找错 Region |
| snapshot / destroy 处理 | 新 Peer 要能追数据，被删 Peer 要及时停掉，避免旧 Peer 继续处理日志 |

Lab3B 最容易出问题的是“split 之后状态没有同时收敛”。也就是说，本地可能已经拆成 left/right 两个 Region，但 scheduler、router、peer 生命周期、请求入口检查还没有完全同步。我们遇到并整理过三个典型问题：

| 问题 | 简短解释 |
|---|---|
| scheduler 暂时找不到 right region | split 后只上报 left，scheduler 先删掉 old region，right 还没上报，右半边 range 会短暂空出来 |
| 被删 Peer 继续 apply | `RemoveNode` 删除自己后，这个 Peer 已经 stopped，但同一个 Ready 里后续日志不能再继续 apply |
| 越界请求没有稳定返回 `KeyNotInRegion` | 普通 KV 请求不能只等 apply 阶段检查 key range，进入 Raft 前也要检查 |

这几个问题的详细排查过程和修复思路记录在 [Lab3B split 状态收敛问题](./lab3b-split-heartbeat-difficulty.md)。

## C 部分：调度器

调度器有点像 TiKV 里的 PD。

它可以先理解成“集群管理员”。它不直接处理用户读写请求，而是做三件事：

```text
1. 收集每个 Region 的心跳。
2. 根据全局情况判断哪里不均衡。
3. 给 TinyKV 节点发调度命令。
```

比如：

```text
Store 1 上 Region 太多
Store 4 上 Region 太少
调度器决定把某个副本从 Store 1 搬到 Store 4
```

这个“搬副本”通常不是直接拷贝文件，而是借助 A 部分的成员变化：

```text
1. 给这个 Region 在 Store 4 上加一个 Peer。
2. 等 Store 4 上的新 Peer 通过 Raft 追上数据。
3. 删除 Store 1 上的旧 Peer。
```

所以 C 部分依赖 A 部分：调度器负责做决定，真正修改 Region 副本集合还是通过 Raft 成员变更完成。

整体感觉是：

{% mermaid %}
sequenceDiagram
    participant T as TinyKV节点
    participant S as 调度器

    T->>S: 汇报 Region 状态
    S->>S: 判断是否需要搬副本
    S-->>T: 返回调度命令
    T->>T: 通过 Raft 执行成员变更
{% endmermaid %}

更完整地看，调度器做的是“观察 -> 决策 -> 返回 operator”：

{% mermaid %}
sequenceDiagram
    participant Store1 as Store 1
    participant Store2 as Store 2
    participant Store4 as Store 4
    participant Sch as Scheduler

    Store1->>Sch: Region heartbeat<br/>我有很多 Region / Peer
    Store2->>Sch: Region heartbeat
    Store4->>Sch: Region heartbeat<br/>我比较空
    Sch->>Sch: 更新全局 Region/Store 信息
    Sch->>Sch: 发现 Store 1 太满，Store 4 较空
    Sch-->>Store1: Operator: MovePeer<br/>把 Region 1 的 Peer 搬到 Store 4
{% endmermaid %}

`MovePeer` 里面通常包含多个小步骤：

{% mermaid %}
graph LR
    Start["Region 1 的 Peer 在 Store 1/2/3"] --> Add["Step 1: AddPeer<br/>在 Store 4 新增 Peer"]
    Add --> CatchUp["Step 2: 新 Peer 通过 Raft<br/>追上已有日志/快照"]
    CatchUp --> MaybeTransfer["Step 3: 如果旧 Peer 是 leader<br/>先 TransferLeader"]
    MaybeTransfer --> Remove["Step 4: RemovePeer<br/>删掉 Store 1 上旧 Peer"]
    Remove --> Done["Region 1 的 Peer 分布变成<br/>Store 2/3/4"]
{% endmermaid %}

这张图能看出 C 部分和 A 部分的关系：Scheduler 只是决定要搬，真正的搬迁动作还是靠 A 部分的 `AddPeer`、`RemovePeer`、`TransferLeader`。

Lab3C 主要改 scheduler：

| 文件 | 主要任务 |
|---|---|
| `scheduler/server/cluster.go` | `processRegionHeartbeat`：接收 Region 心跳，过滤过期 epoch，更新 region tree 和 store 状态 |
| `scheduler/server/schedulers/balance_region.go` | `Schedule`：找出 region 过多的 store，把合适的 Region 迁到更空的 store |
| `scheduler/server/schedule/operator` | 理解 `MovePeer` operator 如何拆成 AddPeer / TransferLeader / RemovePeer |

一句话：Lab3B 是节点执行管理命令，Lab3C 是调度器决定该给哪些节点发管理命令。

我们本地完成 Lab3C 时，主要补的是这条链路：

```text
Region heartbeat
  -> cluster 更新 Region/Store 缓存
  -> balance-region scheduler 找出最忙和最空的 Store
  -> 选择一个适合搬迁的 Region
  -> 创建 MovePeer operator
  -> operator 后续拆成 AddPeer / TransferLeader / RemovePeer
```

换成人话就是：

```text
节点告诉 scheduler：“我这里有哪些 Region。”
scheduler 统计以后发现：“这个 Store 太满，那个 Store 太空。”
scheduler 返回一个搬迁计划：“先在空 Store 加副本，追上后再删掉满 Store 的旧副本。”
```

所以 Lab3C 的核心不是自己搬数据，而是生成一个正确的计划。真正执行计划时，还是回到 Lab3A/Lab3B 的成员变更能力。

## A/B/C 串起来看

Lab3 不是三个孤立功能，它们其实是一条完整链路：

```text
Region 太大
  -> B 部分把它 split 成两个 Region

某些 Store 上 Peer 太多
  -> C 部分的调度器发现不均衡
  -> 调度器决定把某个 Region 的 Peer 搬走
  -> A 部分通过 add peer / remove peer 真正完成搬迁

某些 Store 上 leader 太多
  -> C 部分的调度器发现 leader 不均衡
  -> A 部分通过 leader transfer 换 leader
```

所以可以这样记：

| 部分 | 角色 |
|---|---|
| A 部分 | 提供“怎么改一个 Region 的副本集合”的能力 |
| B 部分 | 提供“怎么把一个大 Region 拆小”的能力 |
| C 部分 | 提供“什么时候该改、该拆、该搬”的全局视角 |

更口语一点：

```text
B 负责把分片切小。
A 负责移动某个分片的副本、换 leader。
C 负责站在全局看，决定该不该移动。
```

## 一个重要概念：Region 版本

Lab3 里会看到 `RegionEpoch`。它可以理解成 Region 元信息的版本号。

它主要防止一种问题：

```text
网络分区里，一个旧主节点还以为自己是主节点。
它向调度器汇报了旧的 Region 信息。
调度器不能被它骗到。
```

所以调度器会看 Region 版本。如果版本太旧，就拒绝这次汇报。

图上看是这样：

{% mermaid %}
graph TB
    Old["旧心跳<br/>Region 1<br/>range: [a, z)<br/>epoch: version=1, conf_ver=1"]
    New["新心跳<br/>Region 1<br/>range: [a, m)<br/>epoch: version=2, conf_ver=1"]
    Scheduler["Scheduler<br/>保存最新 Region 信息"]

    Old --> CheckOld["检查 epoch<br/>发现 version 更旧"]
    CheckOld --> Reject["拒绝旧信息<br/>避免用过期范围调度"]

    New --> CheckNew["检查 epoch<br/>版本更新"]
    CheckNew --> Accept["接受并更新 Region 信息"]

    Accept --> Scheduler
{% endmermaid %}

简单记：

```text
Region split 会让 version 变大。
加删 Peer 会让 conf_ver 变大。
Scheduler 用 RegionEpoch 判断谁的信息更新。
```

## 怎么测试

Lab3 总测试：

```bash
make project3
```

也可以分开跑：

```bash
make project3a
make project3b
make project3c
```

每个小阶段大概测：

| 命令 | 测什么 |
|---|---|
| `make project3a` | Raft 层能不能加副本、删副本、转移主节点 |
| `make project3b` | raftstore 能不能处理成员变更、主节点转移、Region 分裂 |
| `make project3c` | 调度器能不能处理心跳，并做基本负载均衡 |

主要测试文件：

```text
raft/raft_test.go
raft/rawnode_test.go
kv/test_raftstore/test_test.go
scheduler/server/cluster_test.go
scheduler/server/schedulers/balance_test.go
```

本地收尾时重点回归过之前最容易失败的两个 Lab3B 测试：

| 测试 | 最近验证结果 | 为什么重点看它 |
|---|---|---|
| `TestOneSplit3B` | 10/10 PASS | 会检查 split 后 left/right region 是否正确，以及越界请求是否返回 `KeyNotInRegion` |
| `TestSplitConfChangeSnapshotUnreliableRecoverConcurrentPartition3B` | 10/10 PASS | 会把 split、conf change、snapshot、网络不可靠和分区揉在一起，最容易暴露状态收敛问题 |

我们还新增了一个本地辅助脚本：

```bash
scripts/test_lab3b.sh
```

它可以多轮跑 Lab3B 的 smoke/conf/split/all 测试，适合排查偶发失败。比如只跑 split 相关测试 10 轮：

```bash
RUNS=10 SKIP_3A=1 scripts/test_lab3b.sh split
```

更完整的测试命令在 [测试指南](./testing-guide.md)。

## 面试怎么说

可以这样讲：

> TinyKV Lab3 是把单 Raft 组扩展成 Multi-Raft。Lab2 可以理解成一个 Region 管全部 key，Lab3 会把 key 空间切成多个 Region，每个 Region 背后都有自己的 Raft 组。这个 Lab 要支持给 Region 加副本、删副本、转移 leader、分裂 Region，以及让调度器根据 heartbeat 做副本均衡。它的目标是让 KV 存储能横向扩展。

## 和 MIT 6.5840 的关系

Lab3 和 MIT 6.5840 Lab5 都有“分片”的味道，但不是同一个模型。

| 对比 | TinyKV Lab3 | MIT Lab5 |
|---|---|---|
| 分片方式 | 按 key 范围切成 Region | 固定数量 shard |
| 每片背后 | 一个 Raft 组 | 一个 Raft 组 |
| 谁调度 | TinyScheduler | shard controller |
| 更像什么 | TiKV/PD | 教学版分片 KV |

一句话：

```text
MIT Lab5 更强调 shard 迁移时的线性一致。
TinyKV Lab3 更强调真实数据库里的 Region、成员变更和调度。
```

## 参考资料

- Project 3 MultiRaftKV：https://yunpengn.github.io/tinykv/doc/project3-MultiRaftKV.html
- TinyKV 仓库：https://github.com/talent-plan/tinykv
- 本仓库源码：`raft/raft.go`
- 本仓库源码：`raft/rawnode.go`
- 本仓库源码：`kv/raftstore`
- 本仓库源码：`scheduler/server`
- 本仓库源码：`scheduler/server/schedulers`
