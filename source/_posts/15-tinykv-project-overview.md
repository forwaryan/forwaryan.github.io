---
title: "TinyKV 项目总览：从课程骨架到存储系统"
date: "2026-06-02 09:59:00"
updated: "2026-06-02 11:30:00"
permalink: "2026/06/02/tinykv-project-overview/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "分布式系统"
  - "TiKV"
  - "学习路线"
---

> 来源：本地 `README.md`、`tinykv-understanding/README.md`。官方 Project 文档只做引用，不整段搬运。

<figure class="tinykv-svg-figure">
  <a href="/images/posts/tinykv-labs/tinykv-doc-coverage.svg" target="_blank" rel="noopener"><img src="/images/posts/tinykv-labs/tinykv-doc-coverage.svg" alt="TinyKV 本地文档和博客覆盖关系"></a>
  <figcaption>这次补发的重点：把本地自有中文材料放到博客，官方英文 Project 文档只作为索引。</figcaption>
</figure>

TinyKV 可以当成一条很完整的数据库存储层训练线。它从一个能读写 BadgerDB 的单机 KV 开始，往上加 Raft、Region、Scheduler，最后再加 MVCC 和 Percolator 风格事务。

我更喜欢按系统问题来读它：数据先怎么落盘，再怎么复制，容量不够时怎么拆分，多个客户端并发读写时怎么给出稳定语义。这样看，Lab 之间不是孤立作业，而是一层层往上搭的存储系统。

<!-- more -->

## 项目在做什么

官方 README 对 TinyKV 的定位很直接：它借鉴 MIT 6.824 和 TiKV，用 Raft 做一个支持事务的分布式 KV 存储服务。课程开始时只给骨架代码，核心逻辑要按 Project 1 到 Project 4 补完。

对应到我平时说的 Lab，大概是这样：

| Lab | 系统问题 | 实现重心 | 博客文章 |
| --- | --- | --- | --- |
| Lab1 | 单机数据怎么可靠读写 | `StandaloneStorage`、Raw KV API、Badger 封装 | [StandaloneKV](/2026/06/02/tinykv-lab1-standalonekv/) |
| Lab2 | 多副本怎么按同一顺序执行 | Raft、Ready、raftstore、snapshot | [RaftKV](/2026/06/02/tinykv-lab2-raftkv/) |
| Lab3 | key 空间怎么横向拆分和调度 | Region、Peer、Store、Scheduler | [Multi-RaftKV](/2026/06/02/tinykv-lab3-multiraftkv/) |
| Lab4 | 并发读写怎么有事务语义 | MVCC、lock/write/default、Percolator | [Transactions](/2026/06/02/tinykv-lab4-transactions/) |

## 代码目录怎么读

| 目录 | 先抓住什么 |
| --- | --- |
| `kv` | KV 服务和存储层，Lab1、Lab2B、Lab3、Lab4 都会碰到 |
| `raft` | Raft 算法本体，重点是状态转换、日志复制、Ready/Advance |
| `scheduler` | TinyScheduler，维护 Store/Region 状态并生成调度任务 |
| `proto` | gRPC 和 protobuf 定义，请求、响应、Raft 消息都从这里来 |
| `doc` | 官方 Project 文档和阅读清单，适合查任务边界 |
| `tinykv-understanding` | 本地中文理解文档，已经整理成博客 Lab 系列 |

## 我会怎么讲这个项目

面试里不要一开口就钻到 Raft 选举。更稳的讲法是先给出系统边界：TinyKV 关注数据库的存储层，不做 SQL 优化器，也不做完整生产级 TiKV 的所有调度和监控。然后按请求路径展开：

```text
Client -> KV API -> Storage / RaftStorage -> Raft group -> apply -> BadgerDB
```

如果问到事务，再补上 MVCC 这层：

```text
Transactional API -> MVCC -> default/write/lock CF -> 底层 KV
```

这个讲法的好处是边界清楚。Lab1 不是“太简单所以跳过”，它是后面所有 apply 的落点；Lab4 也不是凭空多出来的事务题，它是把版本和锁编码进同一套 KV 存储里。

## 哪些本地文档已经发到博客

| 本地文档 | 博客位置 |
| --- | --- |
| `tinykv-understanding/labs/tinykv-lab-roadmap.md` | [TinyKV Lab 路线图](/2026/06/02/tinykv-lab-roadmap/) |
| `tinykv-understanding/labs/lab1-standalonekv.md` | [Lab1：StandaloneKV](/2026/06/02/tinykv-lab1-standalonekv/) |
| `tinykv-understanding/labs/lab2-raftkv.md` | [Lab2：RaftKV](/2026/06/02/tinykv-lab2-raftkv/) |
| `tinykv-understanding/labs/lab3-multiraftkv.md` | [Lab3：Multi-RaftKV](/2026/06/02/tinykv-lab3-multiraftkv/) |
| `tinykv-understanding/labs/lab3b-split-heartbeat-difficulty.md` | [Lab3B：Region Split 后的状态收敛问题](/2026/06/02/tinykv-lab3b-region-split-state-convergence/) |
| `tinykv-understanding/labs/lab4-transactions.md` | [Lab4：Transactions](/2026/06/02/tinykv-lab4-transactions/) |
| `tinykv-understanding/labs/testing-guide.md` | [TinyKV 测试指南](/2026/06/02/tinykv-testing-guide/) |
| `interview-experiences/tinykv-tikv-6.824-mianshi.md` | [面经索引](/2026/06/02/tinykv-interview-experience-index/) |
| `interview-experiences/tinykv-lab-question-map.md` | [问题和 Lab 对照表](/2026/06/02/tinykv-interview-lab-question-map/) |
| `doc/reading_list.md` | [阅读清单](/2026/06/02/tinykv-reading-list/) |

`doc/project1-StandaloneKV.md` 到 `doc/project4-Transaction.md` 是官方任务书，我没有直接搬到博客里。Lab 文章里会引用它们，真正的解释还是用自己的话写。
