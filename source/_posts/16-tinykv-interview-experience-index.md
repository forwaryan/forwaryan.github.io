---
title: "TinyKV / TiKV / MIT 6.824 面经索引"
date: "2026-06-02 09:58:00"
updated: "2026-06-02 12:30:00"
permalink: "2026/06/02/tinykv-interview-experience-index/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "TiKV"
  - "MIT 6.824"
  - "面试"
  - "Raft"
  - "事务"
---

> 来源：本地 `interview-experiences/tinykv-tikv-6.824-mianshi.md`、`interview-experiences/tinykv-lab-question-map.md`，更新口径是 2026-06-01。

<figure class="tinykv-svg-figure">
  <a href="/images/posts/tinykv-labs/tinykv-interview-map.svg" target="_blank" rel="noopener"><img src="/images/posts/tinykv-labs/tinykv-interview-map.svg" alt="TinyKV 面经问题按 Lab 反查"></a>
  <figcaption>面经不要只按公司看，更要按系统层次拆：存储、复制、分片、事务、工程外延。</figcaption>
</figure>

我把最近两年和 TinyKV、TiKV、MIT 6.824/6.5840 相关的面经单独拎出来了。牛客和个人博客权重最高，因为它们通常会记录逐轮问题；问答站和路线帖可以看，但不适合作为主证据。

看这张表的时候，重点不是背公司名字，而是找追问模式：Raft 会追异常场景，事务会追 Percolator 和锁清理，存储引擎会追 LSM/Badger，TinyKV 项目会追你到底改过哪些模块。

<!-- more -->

## 筛选口径

- 主来源：牛客逐轮面经、个人博客/技术博客复盘。
- 暂不把 AskTUG 放入主表；它更像问答/题库，面经价值偏弱。
- 权重规则：2025/2024 且逐题记录为高权重；2023 及以前、博客复盘、路线类文章为中低权重。
- 关键词范围：TinyKV、TiKV、MIT 6.824、MIT 6.5840、Raft、Percolator、LSM、数据库内核、分布式存储。

## 高权重：近两年逐题面经

| 权重 | 时间 | 来源 | 公司/岗位 | 类型 | 重点问题 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| 高 | 2025-09-07 | 牛客 | 百度秋招提前批 C++ 后端二面 | 校招提前批 | Percolator vs 单体数据库事务、Raft 全流程、ACID/CAP、CMU 15445 隔离级别、LRU-K、crabbing、线程安全 LRU、KV 场景题 | [百度秋招提前批 C++ 后端二面](https://www.nowcoder.com/discuss/794221390416056320) |
| 高 | 2025-08-07 | 牛客 | 百度后端开发三面 | 校招提前批 | 分布式唯一 ID、分布式事务、2PC、Percolator、Raft 小问题、OceanBase 比赛经历 | [百度提前批后端三面](https://www.nowcoder.com/feed/main/detail/abb24dcd0be74b6a8e357b9210c23706) |
| 高 | 2025-08-01 | 牛客 | 腾讯 TEG DB 内核开发二面 | 校招/提前批倾向 | TinyKV 优化点、BadgerDB、LSM Tree、LSM vs B+Tree、Hash 冲突、并发 HashMap、mmap 持久化崩溃恢复、手写 HashMap | [腾讯 TEG DB 内核开发二面](https://www.nowcoder.com/feed/main/detail/e850fb75bac94d7bb8d7e12ed9847713) |
| 高 | 2025-07-23 | 牛客 | 百度提前批二面 | 校招提前批 | CMU 15445 + TinyKV、Multi-Raft 必要性、Percolator、Raft 选举/日志复制、脑裂、PreVote、Leader Lease、ReadIndex、广告日志 KV 场景题 | [百度提前批二面](https://www.nowcoder.com/feed/main/detail/25a35016f31a44d5b7d7bab011e0ec4d) |
| 高 | 2025-04-24 | 牛客 | 字节客服平台一面 | 未明确，偏实习/春招 | Raft、Percolator、Multi-Raft、MVCC、事务隔离级别、多数据中心、过期时间 LRU、redo/undo log | [字节客服平台一面](https://www.nowcoder.com/discuss/744942960445263872) |
| 高 | 2025-03 左右 | 牛客 | TikTok 直播后端开发 | 实习 | TiKV 成熟产品案例、LSM Tree、Raft、CAP、一致性模型、ReadIndex、Lease Read、Leader Lease、Bloom Filter、KV 分离 | [TikTok 直播后端实习三轮技术面](https://www.nowcoder.com/feed/main/detail/d810c41ff9c3425196f274fd08750711) |
| 高 | 2024-03-26 | 牛客 | 腾讯 WXG 后台开发 | 实习 | Raft 如何保证一致性、Raft 存储实现、性能测试、脑裂恢复、日志选举、LevelDB、MVCC、KV 存储设计 | [腾讯实习基地 WXG 后台开发](https://www.nowcoder.com/discuss/595685640251912192) |
| 高 | 2024-03 | 牛客 | 腾讯日常实习一面 | 日常实习 | MIT 6.824 Raft、Leader 宕机、选举冲突、Redis 持久化、IO 多路复用、Go 使用 | [腾讯日常实习一面](https://www.nowcoder.com/feed/main/detail/f2b331c471da4a7a9e28c856a9cca7fa) |

## 中权重：稍早但问题密度高

| 权重 | 时间 | 来源 | 公司/岗位 | 类型 | 重点问题 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| 中 | 2023-08 | 牛客 | 字节基架 | 校招提前批 | TinyKV 中 Raft/Percolator、PreVote、ReadIndex、LeaseRead、FollowerRead、GMP、K8s、redo log 复制 | [两周盘下字节基架校招 Offer](https://www.nowcoder.com/discuss/523450756540735488) |
| 中 | 2023-03/04 | 牛客 | 腾讯 IEG 游戏数据科学后端 | 暑期实习 | Raft KV-Store、Snapshot 持久化和一致性、边写 Snapshot 边服务、解释 Raft、MIT 6.824 是什么、select/epoll、Spinlock vs Mutex | [腾讯 IEG 暑期实习面经](https://www.nowcoder.com/discuss/474897171309924352) |
| 中 | 2022 秋招 | 牛客 | 美团/百度/StarRocks/蚂蚁等数据库内核 | 校招 | TinyKV 生产化问题、Percolator 性能、Raft 成员变更、LevelDB、LSM、B+Tree、OceanBase 架构 | [2022 年秋招后端数据库内核面经](https://www.nowcoder.com/discuss/482970517188751360) |
| 中 | 2022-09 | 个人博客 | RisingWave Labs Database Kernel Rust | 实习 | TiKV 扩容、Region 分裂、Raft Group 迁移、Snapshot、LSM/LevelDB、Bloom Filter、Bitcask、HashMap resize | [RisingWave Labs 实习面试](https://waruto.top/posts/risingwave-intern-interview/) |

## 低权重：路线和旧资料参考

| 权重 | 时间 | 来源 | 公司/方向 | 类型 | 参考价值 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| 低 | 2022-09 | 个人博客 | 23 届数据库/存储秋招 | 校招复盘 | 阿里云、字节、百度、小红书、StarRocks、SelectDB 等数据库/存储方向整体风格；推荐 MIT 6.824/TinyKV | [23 届小硕秋招分享：数据库/存储方向](https://tanweime.com/2022/09/11/23%E5%B1%8A%E5%B0%8F%E7%A1%95%E7%A7%8B%E6%8B%9B%E5%88%86%E4%BA%AB-%E6%95%B0%E6%8D%AE%E5%BA%93%3A%E5%AD%98%E5%82%A8%E6%96%B9%E5%90%91/) |
| 低 | 2022-03 | 个人博客 | 数据库内核求职路线 | 校招/春招复盘 | 6.824 -> TinyKV -> CMU 15-445 路线；高频题包括 PreVote、ReadIndex、LeaseRead、Raft 持久化、成员变更、Percolator、LSM vs B+Tree | [应届生如何半年找到数据库内核工作](https://www.inlighting.org/archives/how-to-find-a-database-job) |
| 低 | 2022-01 | 牛客 | Shopee 北京特征存储引擎 | 社招/实习信息不明 | PingCAP Talent Plan TinyKV、Badger/LSM、WiscKey、SSD 随机读写、LSM 写入流程、Raft 读流程、2PC 缺点、mmap/CGO | [Shopee 北京特征存储引擎面经](https://www.nowcoder.com/discuss/831715) |
| 低 | 2021-04 | 牛客 | PingCAP 数据库工程师 | 春招实习 | 6.824 背景、Raft Figure 8、IO 多路复用、RPC 调用链路、ACID/CAP、分布式事务、OS 内存/页表/调度 | [PingCAP 数据库工程师春招实习面经](https://www.nowcoder.com/discuss/353157760177086464) |
| 低 | 未标明 | Go 语言中文网 | PingCAP 研发 | 实习 | 分布式锁、Etcd/Redis 锁实现、故障/网络中断测试、事务隔离级别、申请内存流程、CPU 调度、Go 协程/GC、网络栈、IO 多路复用 | [PingCAP 研发实习面经](https://studygolang.com/articles/35434) |

## 高频考点聚类

### Raft / Multi-Raft

优先级最高。近两年的百度、腾讯、字节/TikTok 都会追。

- Raft 基本流程：Leader 选举、日志复制、commitIndex、applyIndex、任期、日志匹配性质。
- 异常场景：Leader 宕机、网络分区、脑裂、选举冲突、旧 Leader 恢复、日志分歧。
- 持久化：term、vote、log、snapshot 分别什么时候落盘；崩溃恢复后如何继续。
- Snapshot：什么时候生成，如何安装，边服务边 snapshot 如何保证一致性。
- 读优化：ReadIndex、LeaseRead、Leader Lease、FollowerRead 的适用条件和风险。
- PreVote：解决什么问题，为什么能减少无意义 term 增长。
- Multi-Raft：为什么单 Raft Group 不够，Region/Shard 如何和 Raft Group 对应，Region 分裂与迁移如何做。

### Percolator / 分布式事务

高频出现在百度、字节、数据库内核方向。

- 2PC 基本流程：prewrite、commit、primary key、secondary key、锁记录。
- Percolator 和普通单机事务的区别。
- Percolator 和传统 2PC 的关系：它解决了什么，没解决什么。
- MVCC：timestamp、版本链、读写冲突检测、事务隔离级别。
- 异常恢复：primary 提交但 secondary 未提交怎么办，锁遗留怎么办。
- 性能问题：多轮 RPC、锁冲突、热点 key、事务大小、写放大。

### LSM / RocksDB / Badger / LevelDB

腾讯 TEG、TikTok、RisingWave、Shopee 相关面经里非常密集。

- LSM 写入路径：WAL、MemTable、Immutable MemTable、SSTable、Compaction。
- 读取路径：MemTable、Block Cache、Bloom Filter、SSTable 多层查找。
- LSM vs B+Tree：写入吞吐、读放大、写放大、空间放大、范围查询、缓存友好性。
- Level0 特点：为什么 Level0 文件可能重叠，为什么读放大明显。
- Compaction：触发条件、代价、对延迟的影响。
- Badger/WiscKey：KV 分离，value log，为什么适合大 value。
- Bloom Filter：误判、不漏判、适合过滤什么。

### TinyKV 项目深挖

面试官通常不满足于“我实现了 Raft”，会追你自己的实现细节。

- 你改了哪些模块，遇到过哪些 bug，怎么定位的。
- TinyKV 和真实 TiKV 差在哪里。
- TinyKV 如何做生产化：监控、恢复、限流、配置变更、性能压测、故障注入。
- Raft store、scheduler、region、peer、message flow 的职责边界。
- 如果要支持热点 Region、扩容、迁移、副本均衡，你怎么设计。

### KV 场景题 / 系统设计

这些题通常用来判断你是否能把项目知识迁移到工程设计。

- 设计一个高性能 KV 存储。
- 设计广告日志/直播场景下的 KV 写入系统。
- 设计支持 TTL 的 LRU/LFU/缓存系统。
- 设计分布式唯一 ID。
- 设计并发 HashMap 或持久化 HashMap。
- mmap 持久化后进程崩溃，如何保证恢复正确性。

## 高频问题按 Lab 反查

面试时不要把所有题都往 Raft 上贴。先判断问题属于哪一层，再讲这一层的请求路径、关键文件、异常场景和取舍。

| 面试问题 | 主要对应 Lab | 回答锚点 |
| --- | --- | --- |
| TinyKV 整体架构是什么 | 全部 | 从 `Storage` -> Raft -> Region/Scheduler -> MVCC 串起来，不要只讲 Raft |
| TinyKV 和 TiKV 差在哪里 | 全部，偏工程化 | TinyKV 保留存储层主链路，但缺生产 TiKV 的完整 PD、监控、性能优化和复杂调度 |
| RawGet / RawPut / RawScan 怎么实现 | Lab1 | `raw_api.go`、`StandaloneStorage.Reader/Write`、Badger、CF 前缀封装 |
| BadgerDB / LSM / B+Tree 怎么理解 | Lab1 外延 | TinyKV 调用 Badger，不是手写 LSM；回答重点放在读写放大、compaction、范围查询 |
| Raft 选主、日志复制、Figure 8 | Lab2A | `raft.go`、`log.go`、term/vote/log、prevLogIndex/prevLogTerm、当前 term commit 规则 |
| RawNode / Ready / Advance 是什么 | Lab2A/2B | Raft 不直接做 IO；Ready 把 entries、messages、committed entries 交给 raftstore |
| KV 请求如何接入 Raft | Lab2B | 请求变成 `RaftCmdRequest`，leader propose，commit 后 apply 到 Badger，再 callback |
| 为什么读请求也走 Raft | Lab2B | baseline 用 Raft 保证线性一致；ReadIndex、LeaseRead 是后续优化 |
| Log GC / Snapshot 怎么做 | Lab2C | CompactLog 也走 Raft；落后副本缺日志时用 snapshot 追状态机 |
| Multi-Raft 为什么必要 | Lab3 | 单 Raft group 串行全部 key；Region 按 range 切分后，不同 Raft group 可以并行 |
| Store / Peer / Region 区别 | Lab3 | Store 是机器/进程，Region 是 key range，Peer 是某个 Region 的一份副本 |
| Region split 如何保证一致 | Lab3B | split 作为 admin command 进入 Raft，commit 后更新 RegionEpoch、range、storeMeta |
| Scheduler 做什么 | Lab3C | 收集 heartbeat，维护全局 Region/Store 状态，生成 add/remove peer、transfer leader 等 operator |
| MVCC 是什么 | Lab4A | `default/write/lock` 三个 CF：value、提交记录、未提交锁 |
| Prewrite / Commit 怎么走 | Lab4B | prewrite 检查冲突并写 lock/default；commit 写 write 并删 lock |
| 遗留锁怎么处理 | Lab4C | `CheckTxnStatus` 判断 primary 状态，`ResolveLock` 推动 secondary commit 或 rollback |
| primary commit 后 secondary 没提交怎么办 | Lab4C | primary 已提交后 secondary 不能回滚，后续请求应 resolve 为 commit |
| ReadIndex / LeaseRead / PreVote / FollowerRead | Lab2/3 拓展 | 先说明 TinyKV baseline，再讲生产读优化依赖的多数派确认、租约或 follower 一致性条件 |
| 分布式唯一 ID、并发 HashMap、LRU | 非 TinyKV 主线 | 不要硬贴 TinyKV；可以类比 timestamp oracle、缓存或 KV 场景设计，单独回答 |

如果要背文件，可以按这个顺序压缩：

| Lab | 重点文件 |
| --- | --- |
| Lab1 | `kv/server/raw_api.go`、`kv/storage/standalone_storage/standalone_storage.go`、`kv/util/engine_util/*` |
| Lab2 | `raft/raft.go`、`raft/log.go`、`raft/rawnode.go`、`kv/raftstore/peer_storage.go`、`kv/raftstore/peer_msg_handler.go` |
| Lab3 | `kv/raftstore/peer.go`、`kv/raftstore/router.go`、`kv/raftstore/runner/split_checker.go`、`scheduler/server/cluster.go` |
| Lab4 | `kv/transaction/mvcc/transaction.go`、`lock.go`、`write.go`、`kv/server/server.go` |

## 刷题顺序建议

1. 先刷 2025 百度两篇、腾讯 TEG、TikTok 直播后端。
2. 再刷 2024 腾讯 WXG 和腾讯日常实习，补 Raft 实现细节。
3. 然后看 2023 字节基架和 2022 数据库内核合集，整理老但经典的数据库内核追问。
4. 最后看 RisingWave、数据库内核求职博客，用来补 LSM、TiKV 扩容、Region、Snapshot 等工程化表达。

## 面试回答准备模板

每个项目问题尽量按这个结构答：

1. 背景：这个模块解决什么问题。
2. 核心机制：关键数据结构、状态机、消息流或读写路径。
3. 异常场景：宕机、网络分区、并发冲突、恢复流程。
4. 工程取舍：吞吐、延迟、一致性、可用性、复杂度之间的选择。
5. 自己做过什么：实现、调试、测试、压测、优化或复盘。
