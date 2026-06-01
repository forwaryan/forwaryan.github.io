---
title: "TinyKV 测试指南"
date: "2026-06-02 10:00:00"
updated: "2026-06-02 10:00:00"
permalink: "2026/06/02/tinykv-testing-guide/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "测试"
  - "分布式系统"
---

> 本文整理自本地 TinyKV 项目文件：`tinykv-understanding/labs/testing-guide.md`。
> 系列顺序：[TinyKV Lab 路线图](/2026/06/02/tinykv-lab-roadmap/) -> [TinyKV Lab1：StandaloneKV](/2026/06/02/tinykv-lab1-standalonekv/) -> [TinyKV Lab2：RaftKV](/2026/06/02/tinykv-lab2-raftkv/) -> [TinyKV Lab3：Multi-RaftKV](/2026/06/02/tinykv-lab3-multiraftkv/) -> [TinyKV Lab3B：Region Split 后的状态收敛问题](/2026/06/02/tinykv-lab3b-region-split-state-convergence/) -> [TinyKV Lab4：Transactions](/2026/06/02/tinykv-lab4-transactions/) -> [TinyKV 测试指南](/2026/06/02/tinykv-testing-guide/)。

官方 Makefile：https://github.com/talent-plan/tinykv/blob/course/Makefile

这份文档只回答一个问题：每个 Lab 应该怎么跑测试，测试大概在查什么。

## 最常用命令

在 TinyKV 源码根目录运行：

```bash
make project1
make project2
make project3
make project4
```

如果只想跑某个小阶段：

```bash
make project2aa
make project2ab
make project2ac
make project2a
make project2b
make project2c

make project3a
make project3b
make project3c

make project4a
make project4b
make project4c
```

<!-- more -->

## Windows 注意

官方 Makefile 用的是 Bash 写法。Windows 上建议用 WSL 或 Git Bash。

如果你在 PowerShell 里手动跑 Go 测试，可以这样写：

```powershell
$env:GO111MODULE = "on"
go test -v --count=1 --parallel=1 -p=1 ./kv/server -run 1
```

## 一个容易误判的坑

`project2b`、`project2c`、`project3b` 里面有些测试命令后面带了：

```bash
|| true
```

这表示某条子测试失败后，Makefile 可能还会继续跑后面的测试。

所以不要只看 `make` 最后的退出码，要认真看输出里有没有：

```text
FAIL
```

本地完整回归时建议直接把日志落盘，再统一扫失败关键字：

```bash
make project1 2>&1 | tee /tmp/tinykv-project1.log
make project2 2>&1 | tee /tmp/tinykv-project2.log
make project3 2>&1 | tee /tmp/tinykv-project3.log
make project4 2>&1 | tee /tmp/tinykv-project4.log

grep -nE '(^--- FAIL:|^FAIL( |$)|panic:|fatal error:)' \
  /tmp/tinykv-project1.log \
  /tmp/tinykv-project2.log \
  /tmp/tinykv-project3.log \
  /tmp/tinykv-project4.log
```

如果 `grep` 没有输出，并且各个命令本身也没有异常中断，就可以更有把握地说 Lab1 到 Lab4 都通过了。

## Lab1 测试

命令：

```bash
make project1
```

主要测试文件：

```text
kv/server/server_test.go
```

大概测什么：

| 测试点 | 白话解释 |
|---|---|
| 读 | 能不能读到已有 key |
| 写 | 写完能不能读出来 |
| 删除 | 删除后还能不能读到 |
| 扫描 | 能不能按顺序扫一批 key |
| 读视图 | 扫描时数据视图是否稳定 |

## Lab2 测试

总命令：

```bash
make project2
```

分阶段：

| 命令 | 测什么 |
|---|---|
| `make project2aa` | Raft 选主、投票、心跳 |
| `make project2ab` | 日志复制、日志冲突、提交 |
| `make project2ac` | Raft 和上层交互的接口 |
| `make project2a` | Part A 整体，也就是 2AA/2AB/2AC 全部一起跑 |
| `make project2b` | KV 请求是否经过 Raft 后再执行 |
| `make project2c` | 快照、日志压缩、落后副本恢复 |

`project2aa`、`project2ab`、`project2ac` 都属于 `project2a`。所以看进度时可以这样理解：

```text
project2aa 过了：选主部分基本 OK
project2ab 过了：日志复制部分基本 OK
project2ac 过了：RawNode 接口部分基本 OK
project2a 过了：Lab2A 才算整体 OK
```

主要测试文件：

```text
raft/raft_test.go
raft/raft_paper_test.go
raft/rawnode_test.go
kv/test_raftstore/test_test.go
```

Lab2B 和 Lab2C 会模拟：

```text
多个客户端
网络不可靠
网络分区
节点重启
主节点变化
落后副本追赶
```

## Lab3 测试

总命令：

```bash
make project3
```

分阶段：

| 命令 | 测什么 |
|---|---|
| `make project3a` | Raft 组加副本、删副本、转移主节点 |
| `make project3b` | raftstore 处理成员变更和 Region 分裂 |
| `make project3c` | 调度器处理心跳并做基本均衡 |

主要测试文件：

```text
raft/raft_test.go
raft/rawnode_test.go
kv/test_raftstore/test_test.go
scheduler/server/cluster_test.go
scheduler/server/schedulers/balance_test.go
```

Lab3B 会重点测组合场景：

```text
成员变更 + 重启
成员变更 + 网络不可靠
成员变更 + 快照
Region 分裂 + 多客户端
Region 分裂 + 网络分区
```

本仓库还加了一个 Lab3B 辅助脚本：

```bash
scripts/test_lab3b.sh
```

它适合排查偶发失败，因为可以把某一组测试重复跑很多轮。常用方式：

```bash
# 跑 Lab3B split 相关测试 10 轮，不重复跑 Lab3A
RUNS=10 SKIP_3A=1 scripts/test_lab3b.sh split

# 跑 Lab3B conf change 相关测试 5 轮
RUNS=5 SKIP_3A=1 scripts/test_lab3b.sh conf

# 只跑最快的 smoke 测试
RUNS=3 scripts/test_lab3b.sh smoke
```

如果正在查 split 相关问题，优先关注这两个测试：

| 测试 | 重点 |
|---|---|
| `TestOneSplit3B` | split 后 left/right region 是否正确，越界 key 是否返回 `KeyNotInRegion` |
| `TestSplitConfChangeSnapshotUnreliableRecoverConcurrentPartition3B` | split、conf change、snapshot、网络分区混在一起时状态是否还能收敛 |

## Lab4 测试

总命令：

```bash
make project4
```

分阶段：

| 命令 | 测什么 |
|---|---|
| `make project4a` | 多版本读写、锁、提交记录 |
| `make project4b` | 读、预写、提交 |
| `make project4c` | 扫描、回滚、检查事务状态、处理锁 |

主要测试文件：

```text
kv/transaction/mvcc/transaction_test.go
kv/transaction/commands4b_test.go
kv/transaction/commands4c_test.go
```

Lab4 会重点测：

```text
读到正确历史版本
写冲突判断
遇到锁时如何处理
重复提交
回滚已经提交的事务
锁过期和未过期
扫描时跳过不可见版本
```

## 单独跑一个失败测试

如果某个测试失败，不要每次都跑整个 Lab。可以只跑那一个测试。

例子：

```bash
go test -v --count=1 --parallel=1 -p=1 ./kv/test_raftstore -run ^TestBasic2B$
```

如果想看更多日志：

```bash
LOG_LEVEL=debug make project2b
```

## 推荐排查顺序

先跑小的，再跑大的。

比如 Lab2：

```text
project2aa
  -> project2ab
  -> project2ac
  -> project2a
  -> project2b
  -> project2c
  -> project2
```

这样更容易知道到底是哪一层坏了。
