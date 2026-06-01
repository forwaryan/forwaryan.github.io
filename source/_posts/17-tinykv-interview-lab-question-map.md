---
title: "TinyKV 面试问题和 Lab 对照表"
date: "2026-06-02 09:57:00"
updated: "2026-06-02 11:30:00"
permalink: "2026/06/02/tinykv-interview-lab-question-map/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "面试"
  - "Raft"
  - "事务"
---

> 来源：本地 `interview-experiences/tinykv-lab-question-map.md`，更新口径是 2026-06-01。

<figure class="tinykv-svg-figure">
  <a href="/images/posts/tinykv-labs/tinykv-interview-map.svg" target="_blank" rel="noopener"><img src="/images/posts/tinykv-labs/tinykv-interview-map.svg" alt="TinyKV 面试问题和 Lab 对应关系"></a>
  <figcaption>把问题映射回 Lab，回答时就能落到文件、流程和取舍，而不是只讲概念。</figcaption>
</figure>

面试官问 TinyKV 时，很多问题表面上都像“讲讲 Raft”。但真正回答时最好先分层：这个问题是在问单机存储、复制状态机、Region 调度、事务，还是 TiKV 生产化外延。分层之后，回答会自然很多。

<!-- more -->

下面这份表把面经问题放回 TinyKV 的 Lab 里。我的用法很简单：先判断问题属于哪一层，再准备那一层的请求路径、关键文件和异常场景。

| Lab | 官方 Project | 核心主题 | 测试入口 |
| --- | --- | --- | --- |
| Lab1 | Project1 StandaloneKV | 单机存储层、Raw KV API、Badger/CF 抽象 | `make project1` |
| Lab2A | Project2 Part A | Raft 本体：选主、日志复制、RawNode/Ready | `make project2aa`、`make project2ab`、`make project2ac` |
| Lab2B | Project2 Part B | RaftKV：propose、persist、apply、callback | `make project2b` |
| Lab2C | Project2 Part C | Raft log GC、snapshot 发送和恢复 | `make project2c` |
| Lab3A | Project3 Part A | Raft 成员变更、Leader Transfer | `make project3a` |
| Lab3B | Project3 Part B | ChangePeer、TransferLeader、Region Split | `make project3b` |
| Lab3C | Project3 Part C | Scheduler、Region Heartbeat、balance operator | `make project3c` |
| Lab4A | Project4 Part A | MVCC 存储层，`lock/write/default` 三个 CF | `make project4a` |
| Lab4B | Project4 Part B | `KvGet`、`KvPrewrite`、`KvCommit` | `make project4b` |
| Lab4C | Project4 Part C | `KvScan`、`CheckTxnStatus`、Rollback、ResolveLock | `make project4c` |

## 面经问题到 Lab 的总表

| 面经问题 | 主要对应 Lab | 具体对应点 | 面试回答要点 |
| --- | --- | --- | --- |
| TinyKV 整体架构是什么 | 全部，重点 Lab1-4 主线 | `Storage`、`raft`、`raftstore`、`scheduler`、`transaction` | 从单机存储 -> Raft 复制 -> Multi-Raft 分片 -> MVCC 事务串起来讲，不要一上来只讲 Raft |
| TinyKV 和 TiKV 差在哪里 | 全部，偏工程化拓展 | TinyKV 是教学版，保留存储层核心链路 | 说清 TinyKV 有 Badger、Raft、Region、Scheduler、MVCC，但少很多生产特性，如完整 PD、coprocessor、性能优化、监控和复杂调度 |
| TinyKV 有哪些优化点 | Lab2B、Lab2C、Lab3B、Lab3C、Lab4B/C | apply 异步化、read 优化、snapshot、split、scheduler、事务冲突处理 | 先说你做过的，再说可优化：读请求不用全进 Raft、apply worker 解耦、热点 Region split、调度优化、事务锁清理 |
| 设计一个 KV 存储系统 | Lab1 -> Lab2 -> Lab3 -> Lab4 | Raw KV、复制状态机、Region、MVCC | 先从单机 KV API 和存储引擎说起，再逐步加高可用、横向扩展和事务 |
| RawGet / RawPut / RawDelete / RawScan 怎么实现 | Lab1 | `kv/server/raw_api.go`、`StandaloneStorage.Reader/Write`、`engine_util` | Raw API 直接读写底层 Badger，通过 CF 前缀模拟 column family；Scan 要注意迭代器关闭 |
| BadgerDB 在 TinyKV 里承担什么角色 | Lab1，Lab2B，Lab4A | `kv/storage/*`、`engine_util`、`default/write/lock` CF | Badger 是底层本地 KV 引擎；Lab1 直接用，Lab2 经 Raft apply 后用，Lab4 在其上编码多版本 |
| Column Family 是什么，为什么 TinyKV 需要 CF | Lab1、Lab4A | `engine_util`，事务三 CF | Lab1 先支持 CF 抽象；Lab4 用 `default` 存 value、`write` 存提交记录、`lock` 存锁 |
| LSM Tree / RocksDB / LevelDB / Badger 原理 | Lab1 外延，Lab4A 外延 | TinyKV 使用 Badger，不要求自己实现 LSM | 这是底层存储引擎知识，最贴 Lab1 的存储引擎；回答时说明 TinyKV 调用 Badger，不是在 Lab 里手写 LSM |
| LSM vs B+Tree | Lab1 外延 | 存储引擎选型，不是 Lab 核心代码 | 从写放大、读放大、空间放大、范围查询、缓存友好性讲；不要硬说 TinyKV Lab 实现了 B+Tree |
| Bloom Filter、Compaction、Level0 文件重叠 | Lab1 外延 | Badger/LSM 知识 | 面试中可作为 Badger/LSM 补充，和 TinyKV 的 Raft log compaction 不是同一件事 |
| Raft 基本流程是什么 | Lab2A | `raft/raft.go`、`raft/log.go`、`raft/rawnode.go` | 选主、心跳、日志复制、commit、apply；强调 TinyKV Raft 是 tick 驱动，网络和磁盘由上层处理 |
| Raft 选主怎么做 | Lab2A / `project2aa` | `tick`、`MsgHup`、`MsgRequestVote`、`becomeCandidate/Leader` | election timeout 后 candidate 自增 term、给自己投票、发投票请求，多数同意后成为 leader 并追加 noop |
| Leader 宕机后怎么办 | Lab2A | election timeout、term、vote、heartbeat | follower 收不到心跳触发选举；新 leader term 更大，旧 leader 恢复后看到更大 term 会退回 follower |
| 选举冲突怎么处理 | Lab2A | candidate 多数票、term、随机 election timeout | 多 candidate 可能瓜分选票，等下次超时重新选；不同节点 timeout 随机化降低冲突概率 |
| 脑裂怎么处理 | Lab2A、Lab2B | 多数派、term、ErrNotLeader、日志提交 | Raft 不允许两个 leader 在同一 term 获得多数；少数派 leader 无法提交，恢复后被更大 term 压下去 |
| Raft Figure 8 问题 | Lab2A / `project2ab` | 日志复制、冲突截断、commit 规则 | 重点讲 leader 只能直接提交当前 term 的日志，老 term 日志要靠当前 term 日志间接提交 |
| 日志复制流程 | Lab2A / `project2ab` | `MsgAppend`、`MsgAppendResponse`、`RaftLog`、`Progress` | leader 带 prevLogIndex/prevLogTerm，follower 检查匹配后追加；冲突则截断；leader 根据多数 match 推进 commit |
| 日志分歧如何判断和修复 | Lab2A / `project2ab` | prev index/term 检查、冲突删除、重新 append | follower 如果 prev 不匹配就拒绝；leader 回退 next index，直到找到共同前缀 |
| commitIndex 和 applyIndex 区别 | Lab2A、Lab2B | Raft commit vs 状态机 apply | commit 表示多数复制完成，apply 表示已经交给状态机执行；Lab2B 还要持久化 `RaftApplyState.AppliedIndex` |
| Raft 持久化哪些状态 | Lab2A、Lab2B | HardState、log entries、`RaftLocalState`、`RaftApplyState` | Raft 层关注 term/vote/commit/log；raftstore 还要持久化 region/apply 元信息 |
| RawNode / Ready / Advance 是什么 | Lab2A / `project2ac` | `raft/rawnode.go`、`Ready` | Raft 不直接写盘/发包/执行状态机，而是通过 Ready 把待发送消息、待持久化日志、待 apply entry 交给上层 |
| Ready 处理顺序为什么重要 | Lab2B | `HandleRaftReady`、`SaveReadyState`、send、apply、Advance | 先持久化 HardState 和 entries，再发送消息，再 apply committed entries，最后 Advance；顺序错会破坏崩溃恢复语义 |
| KV 请求如何接入 Raft | Lab2B | `RaftStorage`、`proposeRaftCommand`、`applyEntry`、callback | 客户端请求变成 `RaftCmdRequest`，leader propose 成日志，commit 后 apply 到 Badger，再通过 callback 返回 |
| 为什么读请求也要进 Raft | Lab2B | RawGet/Snap 走 Raft，保证读到线性一致数据 | 简单实现里读也进 Raft，保证 leader 属于多数且状态够新；ReadIndex/LeaseRead 是后续优化 |
| ErrNotLeader / ErrStaleCommand 什么时候出现 | Lab2B | `kv/raftstore/util/error.go`、callback | follower 收到请求返回 NotLeader；leader 切换导致旧 callback 等不到原日志时返回 StaleCommand |
| Raft log GC 怎么做 | Lab2C | `CompactLog` admin command、`RaftApplyState.TruncatedState`、raftlog-gc worker | CompactLog 也要先进入 Raft，commit 后更新截断元信息，再异步删除旧日志 |
| Snapshot 什么时候触发 | Lab2C | `Storage.Snapshot()`、`MsgSnapshot` | follower 落后到 leader 已经 compact 掉所需日志时，只能发 snapshot 追数据 |
| Snapshot 如何保证一致性 | Lab2C | `Ready.Snapshot`、`PeerStorage.ApplySnapshot`、region worker | Raft 层只处理 snapshot 元信息；raftstore 应用 snapshot 时清理旧状态、ingest 数据、更新 raft/apply/region 元信息 |
| 边写 snapshot 边服务怎么保证正确 | Lab2C，工程化拓展 | snapshot 生成/应用 worker，Ready 语义 | 回答思路：snapshot 对应某个 committed/applied index，安装时推进 applied/truncated 状态；新写入继续通过 Raft log 排序 |
| Multi-Raft 为什么必要 | Lab3 总体，重点 Lab3B | 多 Region、多 Raft group | 单 Raft group 所有写串行，吞吐和容量受限；Multi-Raft 按 key range 切 Region，不同 Region 可并行处理 |
| Store / Peer / Region 的区别 | Lab3 总体 | `metapb.Region`、`Peer`、`Store` | Store 是进程/机器，Region 是 key range，Peer 是某个 Region 在某个 Store 上的一份副本 |
| Region 如何定位请求 | Lab3B | `storeMeta.regions`、`regionRanges`、request context | 根据 key 找 Region，检查请求携带的 region/epoch 是否新；错了返回 KeyNotInRegion 或 EpochNotMatch |
| Region split 怎么做 | Lab3B | `Split` admin command、`onPrepareSplitRegion`、`onAskSplit`、`applyAdminRequest` | split key 由 split checker 发现，新 Region/Peer id 从 scheduler 申请，split 命令经 Raft commit 后更新两个 Region 元信息 |
| 为什么 TinyKV 用 Range sharding | Lab3B | Region `[start_key, end_key)` | Range 方便 scan 和按前缀聚合，split 主要改元信息；Hash 更均匀但范围扫描不友好 |
| RegionEpoch 是什么 | Lab3B、Lab3C | `conf_ver`、`version` | conf change 增加 `conf_ver`，split 增加 `version`；用来识别 stale region 信息 |
| KeyNotInRegion / EpochNotMatch 什么时候返回 | Lab3B | request region 校验、split 后旧路由 | key 不在当前 Region 返回 KeyNotInRegion；请求携带的 epoch 旧于当前 Region 返回 EpochNotMatch，客户端应重新路由 |
| Raft 成员变更怎么做 | Lab3A、Lab3B | `ProposeConfChange`、`EntryConfChange`、`ApplyConfChange`、`ChangePeer` | Lab3A 实现 Raft 算法层 conf change，Lab3B 在 raftstore commit 后更新 Region peers 和 RegionEpoch |
| AddNode 新 Peer 如何追数据 | Lab3B、Lab2C | `maybeCreatePeer`、snapshot | 新 Peer 初始没有 Region 数据，leader 发现日志缺口后通常通过 snapshot 让它追上 |
| RemoveNode 如何处理 | Lab3B | `destroyPeer`、RegionLocalState tombstone | commit 后从 peers 移除，被移除节点销毁 peer，避免继续参与旧 Raft group |
| Leader Transfer 怎么做 | Lab3A、Lab3B | `MsgTransferLeader`、`MsgTimeoutNow`、`TransferLeader` admin | 当前 leader 检查目标 peer 日志是否够新，不够先补日志，够新后发 TimeoutNow 让目标立即选举 |
| Scheduler 做什么 | Lab3C | `scheduler/server/cluster.go`、heartbeat、operator | Scheduler 收集 Region heartbeat，维护全局 Region/Store 信息，生成 AddPeer/RemovePeer/TransferLeader 等调度步骤 |
| Region heartbeat 怎么处理 | Lab3C | `processRegionHeartbeat`、RegionEpoch stale check | scheduler 不能盲信 heartbeat，要用 epoch 判断新旧，更新 region tree 和 store status |
| balance-region scheduler 怎么选迁移对象 | Lab3C | `balance_region.go`、MovePeer operator | 从 region size 最大的 store 选 region，迁到更空的 store，差值要足够大才值得移动 |
| Percolator / 2PC 流程 | Lab4B、Lab4C，跨 Lab3 | `KvPrewrite`、`KvCommit`、`KvBatchRollback`、`KvResolveLock` | prewrite 写 lock/default，commit 写 write 并删 lock；primary 成功后 secondary 最终必须能 commit 或被 resolve |
| Percolator 和普通 2PC 区别 | Lab4B、Lab4C | primary key、lock、timestamp、客户端驱动恢复 | Percolator 把事务状态写进 KV，通过 primary lock 判断事务状态，客户端遇锁后用 CheckTxnStatus/ResolveLock 清理 |
| MVCC 是什么 | Lab4A | `MvccTxn`、encoded key、`default/write/lock` | 同一个 key 保存多个版本，读按 start_ts 找 commit_ts <= start_ts 的最新提交版本 |
| Snapshot Isolation 怎么保证 | Lab4A、Lab4B | `GetValue`、write conflict 检查 | 读只看 start_ts 前已提交版本；prewrite 检查 start_ts 之后是否已有提交写，避免写冲突 |
| `default/write/lock` 三个 CF 怎么分工 | Lab4A | `lock.go`、`write.go`、`transaction.go` | default 存 value，write 存提交记录和 start_ts，lock 存未提交事务锁 |
| encoded key 为什么 timestamp 降序 | Lab4A | `EncodeKey`、`EncodeKey(userKey, ts)` | 同一个 key 下最新版本排前面，便于 GetValue/Scanner 找可见版本 |
| `MvccTxn.GetValue` 怎么实现 | Lab4A | `transaction.go` | 先在 write CF 找 commit_ts <= start_ts 的最新 write，再用 write.start_ts 到 default CF 取 value |
| `CurrentWrite` / `MostRecentWrite` 查什么 | Lab4A | `transaction.go` | CurrentWrite 查当前事务是否已经提交/回滚；MostRecentWrite 查最近一次提交记录，用于冲突判断 |
| `KvGet` 遇到锁怎么办 | Lab4B | `KvGet`、lock conflict | 如果 key 上有别的事务且锁 start_ts <= 读 start_ts，要返回 locked error，让客户端处理 |
| `KvPrewrite` 做哪些检查 | Lab4B | `KvPrewrite` | 检查是否已有 commit_ts >= start_ts 的写冲突，检查是否已有其他事务锁；通过后写 lock 和 default |
| `KvCommit` 做什么 | Lab4B | `KvCommit` | 检查 lock 属于当前 start_ts，写 write CF 提交记录，删除 lock；没有 lock 或被回滚要按状态处理 |
| 为什么需要 latches | Lab4B、Lab4C | `kv/transaction/latches/latches.go` | TinyKV 可以并发处理事务请求，本地同 key 的 commit/rollback/resolve 需要互斥，避免状态交错 |
| `KvScan` 为什么比 RawScan 难 | Lab4C | `mvcc/scanner.go` | RawScan 直接扫当前值；KvScan 要按 start_ts 对每个 user key 找可见版本，还要处理锁和多版本编码 |
| 遗留锁怎么处理 | Lab4C | `KvCheckTxnStatus`、`KvResolveLock` | 遇到锁先检查 primary lock 状态和 TTL，超时则 rollback，已提交则推动 secondary commit |
| `KvCheckTxnStatus` 做什么 | Lab4C | `CheckTxnStatus`、TTL、rollback record | 检查 primary lock 是否存在、是否超时、是否已提交；超时写 rollback 并清锁 |
| `KvBatchRollback` 做什么 | Lab4C | rollback write、delete value、remove lock | 对一批 key 回滚当前事务：删除 default 临时 value、删除 lock、写 rollback 记录，要求幂等 |
| `KvResolveLock` 做什么 | Lab4C | commit_ts 为 0 回滚，否则提交 | 扫描属于某 start_ts 的所有锁，根据 commit_ts 决定批量 commit 或 rollback |
| primary commit 成功但 secondary 没提交怎么办 | Lab4C | `ResolveLock` | primary 已提交后，secondary 不能再超时回滚；客户端或后续请求应 resolve secondary locks 为 commit |
| ACID / CAP 怎么和 TinyKV 对应 | Lab2-4 概念题 | Lab2/3 高可用一致性，Lab4 事务语义 | CAP 重点谈 Raft 多数派下一致性和分区时少数派不可用；ACID 里 Atomicity/SI 主要落在 Lab4 |
| ReadIndex / LeaseRead / Leader Lease | Lab2B 拓展，不是必做 Lab 核心 | Raft 读优化，TinyKV 简单实现可让读进 Raft log | 面试中说明 baseline 读进 Raft 保证线性一致；ReadIndex 通过确认 leader 仍在多数派中优化读；LeaseRead 依赖时钟/租约假设 |
| FollowerRead | Lab3 / TiKV 拓展，不是 TinyKV 必做 | follower 读一致性、读索引或 lease | 属于生产 TiKV 读优化；可说和 Lab3 多副本/Region 相关，但不是本 Lab 主线 |
| PreVote | Lab2A 拓展，不是 TinyKV 必做 | 选举前预投票 | 用来减少网络分区节点反复增加 term 干扰 leader；可以挂到 Lab2A 选举机制后讲 |
| 分布式唯一 ID | Lab4 / scheduler 拓展 | timestamp oracle，TinyScheduler 分配时间戳 | 如果面试问 ID 生成，可类比 scheduler 分配全局单调 ts，但 TinyKV Lab 不实现通用 ID 服务 |
| mmap 持久化 HashMap / 并发 HashMap / LRU | 非 TinyKV Lab 主线 | 系统设计、并发编程 | 不要硬贴 TinyKV；最多说和 KV cache、索引、工程优化有关，另起回答 |

## 按 Lab 反查该准备哪些问题

### Lab1：StandaloneKV

重点文件：

- `kv/storage/standalone_storage/standalone_storage.go`
- `kv/server/raw_api.go`
- `kv/storage/storage.go`
- `kv/util/engine_util/*`

应该能回答的问题：

- RawGet、RawPut、RawDelete、RawScan 的请求路径是什么。
- `Storage.Reader` 为什么返回 snapshot reader。
- BadgerDB 在 TinyKV 里是怎么被包装的。
- TinyKV 如何用 key prefix 模拟 Column Family。
- Raw KV 和事务 KV 有什么区别。
- LSM、Badger、RocksDB、LevelDB 是底层存储引擎外延，不是 Lab1 手写内容。

面试回答锚点：

```text
Lab1 是最短路径：RPC handler -> Storage -> Badger。
它解决的是单机读写和 CF 抽象，为后面的 Raft apply 和 MVCC 三 CF 打基础。
```

### Lab2A：Raft 本体

重点文件：

- `raft/raft.go`
- `raft/log.go`
- `raft/rawnode.go`
- `raft/storage.go`
- `proto/proto/eraftpb.proto`

小阶段：

| 小阶段 | 重点问题 |
| --- | --- |
| `project2aa` | 选主、投票、心跳、role change、leader noop |
| `project2ab` | AppendEntries、日志冲突、commit 推进、RaftLog 索引 |
| `project2ac` | RawNode、Ready、Advance、HardState/SoftState |

应该能回答的问题：

- Raft 如何选主，为什么需要随机 election timeout。
- Leader 宕机、旧 leader 恢复、网络分区时 term 如何变化。
- 日志复制如何处理冲突，为什么要检查 prevLogIndex/prevLogTerm。
- commitIndex、appliedIndex、stabledIndex 分别是什么。
- Figure 8 为什么当前 term 日志才能直接 commit。
- RawNode/Ready/Advance 为什么把 Raft 和上层 IO 解耦。

面试回答锚点：

```text
Lab2A 只实现共识算法，不知道 KV 是什么。
它输出的是 Ready：该保存的日志、该发送的消息、该 apply 的 entry。
```

### Lab2B：RaftKV

重点文件：

- `kv/storage/raft_storage/raft_server.go`
- `kv/raftstore/peer_storage.go`
- `kv/raftstore/peer_msg_handler.go`
- `kv/raftstore/peer.go`
- `kv/raftstore/message/*`

应该能回答的问题：

- 客户端 KV 请求如何变成 Raft log。
- `proposeRaftCommand`、`HandleRaftReady`、`applyEntry` 分别负责什么。
- 为什么要先持久化 Ready 再发送消息。
- `PeerStorage.SaveReadyState` 保存什么。
- apply committed entries 时如何更新 `RaftApplyState.AppliedIndex`。
- callback 什么时候返回，leader change 时为什么会有 `ErrStaleCommand`。
- 为什么简单实现里读请求也进 Raft。

面试回答锚点：

```text
Lab2B 把 Lab2A 的通用 Raft 接到 KV 状态机上。
真正写 Badger 的动作发生在日志 commit 之后的 apply 阶段。
```

### Lab2C：Log GC 和 Snapshot

重点文件：

- `kv/raftstore/peer_storage.go`
- `kv/raftstore/runner/raftlog_gc.go`
- `kv/raftstore/runner/region_task.go`
- `kv/storage/raft_storage/snap_runner.go`
- `kv/raftstore/snap/*`

应该能回答的问题：

- Raft log 为什么不能无限增长。
- CompactLog 为什么也要作为 Raft admin command 提交。
- `TruncatedState` 表示什么。
- follower 落后太多时为什么不能继续 AppendEntries，只能发 snapshot。
- snapshot 在 Raft 层和 raftstore 层分别处理什么。
- ApplySnapshot 如何清理旧状态、更新 region/apply/raft 元信息。

面试回答锚点：

```text
Lab2C 处理长期运行问题：日志压缩和落后副本恢复。
日志 GC 是删旧 Raft log，snapshot 是把状态机某一时刻的完整数据发给落后节点。
```

### Lab3A：Raft 成员变更和 Leader Transfer

重点文件：

- `raft/raft.go`
- `raft/rawnode.go`
- `proto/proto/eraftpb.proto`

应该能回答的问题：

- Raft group 如何 AddNode / RemoveNode。
- `EntryConfChange` 为什么也要通过 Raft log 提交。
- `RawNode.ProposeConfChange` 和 `RawNode.ApplyConfChange` 分别做什么。
- Leader Transfer 为什么需要先确认目标 peer 日志足够新。
- `MsgTransferLeader` 和 `MsgTimeoutNow` 的关系。

面试回答锚点：

```text
Lab3A 还是 Raft 算法层。
它只让一个 Raft group 的成员和 leader 可以变化，还没有真正更新 Region 元信息。
```

### Lab3B：Raftstore 管理命令和 Region Split

重点文件：

- `kv/raftstore/peer_msg_handler.go`
- `kv/raftstore/peer.go`
- `kv/raftstore/runner/split_checker.go`
- `kv/raftstore/runner/scheduler_task.go`
- `kv/raftstore/router.go`

应该能回答的问题：

- TransferLeader、ChangePeer、Split 三类 admin command 分别怎么处理。
- `RegionEpoch.conf_ver` 和 `RegionEpoch.version` 分别什么时候增加。
- Region split 后如何维护 old region 和 new region 的元信息。
- 新 Peer 如何创建，如何通过 snapshot 追数据。
- RemoveNode 后如何 destroy peer。
- split 后为什么会出现 `KeyNotInRegion` / `EpochNotMatch`。
- `storeMeta.regions` 和 `regionRanges` 为什么要更新。

面试回答锚点：

```text
Lab3B 是 Multi-Raft 真正落地的地方。
一个 Region 的变化必须先进入它自己的 Raft log，commit 后才能改本地 Region 元信息。
```

### Lab3C：Scheduler

重点文件：

- `scheduler/server/cluster.go`
- `scheduler/server/schedulers/balance_region.go`
- `scheduler/server/schedule/operator/*`

应该能回答的问题：

- Scheduler 为什么需要 Region heartbeat。
- Scheduler 如何判断 heartbeat 是否 stale。
- balance-region scheduler 怎么选择 source store、target store 和 region。
- MovePeer 为什么通常是 AddPeer -> TransferLeader -> RemovePeer。
- PD/TinyScheduler 和 TiKV/TinyKV 的职责边界是什么。

面试回答锚点：

```text
Lab3C 站在全局视角做调度。
TinyKV 节点负责执行 admin command，Scheduler 负责观察集群并生成 operator。
```

### Lab4A：MVCC 存储层

重点文件：

- `kv/transaction/mvcc/transaction.go`
- `kv/transaction/mvcc/write.go`
- `kv/transaction/mvcc/lock.go`
- `kv/transaction/mvcc/scanner.go`

应该能回答的问题：

- MVCC 为什么要保存多个版本。
- `start_ts` 和 `commit_ts` 的区别。
- `default/write/lock` 三个 CF 分别存什么。
- encoded key 为什么按 user key 升序、timestamp 降序排序。
- `GetValue` 如何找到快照可见版本。
- `CurrentWrite`、`MostRecentWrite` 分别用于什么场景。

面试回答锚点：

```text
Lab4A 做的是事务 API 的底层版本工具。
它不处理完整事务流程，只提供读写 lock/write/default 的能力。
```

### Lab4B：事务主流程

重点文件：

- `kv/server/server.go`
- `kv/transaction/latches/latches.go`
- `kv/transaction/mvcc/*`

应该能回答的问题：

- `KvGet` 如何处理 lock 和快照读。
- `KvPrewrite` 为什么既要检查 write conflict，也要检查 lock conflict。
- `KvCommit` 为什么只写 write 记录，不再写 value。
- primary key 和 secondary key 在 Percolator 里分别做什么。
- 为什么需要 latches 防止同 key 本地并发冲突。

面试回答锚点：

```text
Lab4B 是一笔正常事务的主路径：
读快照，prewrite 上锁和写临时 value，commit 写提交记录并删锁。
```

### Lab4C：异常处理、Scan 和锁清理

重点文件：

- `kv/server/server.go`
- `kv/transaction/mvcc/scanner.go`
- `kv/transaction/mvcc/transaction.go`

应该能回答的问题：

- `KvScan` 如何跳过不可见版本并处理锁。
- 遇到遗留锁时客户端为什么要 CheckTxnStatus。
- primary lock 超时如何回滚。
- primary 已提交但 secondary 未提交如何 ResolveLock。
- `KvBatchRollback` 为什么要写 rollback record，为什么要幂等。
- `commit_ts = 0` 的 ResolveLock 为什么表示回滚。

面试回答锚点：

```text
Lab4C 处理事务不顺利时留下的现场。
重点不是新概念多，而是状态分支多：已提交、已回滚、有锁、无锁、锁超时、锁未超时。
```

## 容易混淆的问题

| 问题 | 正确归类 |
| --- | --- |
| LSM compaction vs Raft log GC | LSM compaction 是底层存储引擎外延；Raft log GC 是 Lab2C |
| snapshot isolation vs Raft snapshot | snapshot isolation 是 Lab4 事务隔离；Raft snapshot 是 Lab2C 落后副本恢复 |
| Region split vs Raft log split | TinyKV 里 split 指 Lab3B 的 key range/Region 分裂，不是日志切分 |
| commitIndex vs commit_ts | commitIndex 是 Raft 日志提交位置，Lab2；commit_ts 是事务提交时间戳，Lab4 |
| RawScan vs KvScan | RawScan 是 Lab1 当前值扫描；KvScan 是 Lab4C 多版本快照扫描 |
| ChangePeer vs Scheduler MovePeer | ChangePeer 是 Lab3B 执行单个副本变更；MovePeer 是 Lab3C 生成的一组调度步骤 |
| PreVote vs RequestVote | RequestVote 是 Lab2A 基础选举；PreVote 是生产 Raft 常见优化，TinyKV 基础 Lab 不要求实现 |
| ReadIndex vs 读请求进 Raft log | 读请求进 Raft log 是 Lab2B 简单正确方案；ReadIndex 是线性一致读优化 |

## 面试时的回答策略

如果问题听起来很大，比如“你讲一下 TinyKV”，按这个顺序答：

1. Lab1：先讲单机 Raw KV 和 Storage 抽象。
2. Lab2：再讲 Raft 复制状态机，写请求先入日志，commit 后 apply。
3. Lab3：然后讲 Region/Multi-Raft，解决单 Raft group 扩展性问题。
4. Lab4：最后讲 MVCC/Percolator，解决并发事务和多版本读写。

如果问题听起来很细，比如“Commit 和 Apply 区别”，先定位 Lab：

```text
这是 Lab2 的问题，不是 Lab4 的 commit_ts。
Raft commit 表示日志被多数派复制，apply 表示日志已经被状态机执行。
TinyKV 在 Lab2B 里 apply committed entries，并更新 RaftApplyState.AppliedIndex。
```

如果问题是生产优化，比如 ReadIndex、LeaseRead、PreVote、FollowerRead：

```text
先说明 TinyKV 基础 Lab 的实现边界。
然后把它挂到对应基础机制上：
PreVote -> Lab2A 选举优化
ReadIndex/LeaseRead -> Lab2B 读路径优化
FollowerRead -> Lab3 多副本读优化
```

这样答会比硬背术语稳很多，也能让面试官看到你知道 Lab 里真正写了什么、哪些只是工程拓展。

