---
title: "TinyKV 阅读清单：存储、Raft、分片和事务"
date: "2026-06-02 09:56:00"
updated: "2026-06-02 11:30:00"
permalink: "2026/06/02/tinykv-reading-list/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "数据库内核"
  - "Raft"
  - "阅读清单"
---

> 来源：本地 `doc/reading_list.md`。这份清单来自 TinyKV 项目，我按 Lab 学习顺序补了一层中文导读。

<figure class="tinykv-svg-figure">
  <a href="/images/posts/tinykv-labs/tinykv-reading-stack.svg" target="_blank" rel="noopener"><img src="/images/posts/tinykv-labs/tinykv-reading-stack.svg" alt="TinyKV 阅读清单按系统层次排列"></a>
  <figcaption>阅读材料可以按系统层次放回去：本地存储、复制一致性、分片调度、事务、测试。</figcaption>
</figure>

这份阅读清单不适合从第一条一直啃到最后一条。更好的办法是跟着 Lab 走：Lab1 读存储引擎，Lab2 读 Raft 和一致性，Lab3 读分片和调度，Lab4 再读事务。遇到面试追问，再往对应主题里补论文或博客。

<!-- more -->

## 我会怎么读

| 阶段 | 先看什么 | 用来解释什么 |
| --- | --- | --- |
| Lab1 前后 | Disk I/O、LSM、Badger/WiscKey | Badger 为什么适合做底层 KV，引擎层有哪些读写放大 |
| Lab2 前后 | Quorum、Raft、复制一致性 | 选主、日志复制、commit、snapshot 的系统背景 |
| Lab3 前后 | Range sharding、Multi-Raft、split/balance | Region 为什么按 range 切，Scheduler 为什么需要 heartbeat |
| Lab4 前后 | ACID、Isolation、Percolator | MVCC、2PC、锁清理、事务恢复 |
| 全程 | Benchmark、Chaos、linearizability | 怎么证明系统不只是能跑，还能在故障下保持语义 |

## 原始清单

- Storage Engine
  - Disk I/O
    - Flavors of I/O
      - <https://medium.com/databasss/on-disk-io-part-1-flavours-of-io-8e1ace1de017>
      - <https://medium.com/databasss/on-disk-io-part-2-more-flavours-of-io-c945db3edb13?>
    - Amplification and RUM
      - <http://smalldatum.blogspot.com/2015/11/read-write-space-amplification-pick-2_23.html>
      - <http://daslab.seas.harvard.edu/rum-conjecture/>
      - <http://smalldatum.blogspot.com/2019/05/crum-conjecture-read-write-space-and.html>
  - B-Tree (Optional)
    - Reading Materials
      - Database Internals: 2. B-Tree Basics
      - Database Internals: 3. File Formats
      - Database Internals: 4. Implementing B-Trees
    - Reference
      - <https://www.cs.usfca.edu/~galles/visualization/Algorithms.html>
      - <https://github.com/etcd-io/bbolt>
  - LSM-Tree
    - Reading Materials
      - Database Internals: 7. Log-Structured Storage
    - Reference
      - <https://github.com/google/leveldb>
      - <https://github.com/facebook/rocksdb>
      - <https://github.com/syndtr/goleveldb>
    - B-Tree vs LSM-tree
      - <https://tikv.org/docs/deep-dive/key-value-engine/b-tree-vs-lsm/>
  - LSM-Tree Evolution
    - Wisckey
      - <https://www.usenix.org/system/files/conference/fast16/fast16-papers-lu.pdf>
    - HashKV (Optional)
      - <https://www.usenix.org/system/files/conference/atc18/atc18-chan.pdf>
    - Monkey (Optional)
      - <https://stratos.seas.harvard.edu/files/stratos/files/monkeykeyvaluestore.pdf>
    - Reference
      - <https://github.com/dgraph-io/badger>
      - <https://github.com/tikv/titan>
- Serializing & RPC
  - Protocol Buffer
    - Reading Materials
      - <https://developers.google.com/protocol-buffers/docs/overview>
    - Reference
      - <https://github.com/dgraph-io/badger>
      - <https://github.com/protocolbuffers/protobuf>
  - gRPC
    - Reading Materials
      - <https://www.grpc.io/docs/quickstart/go/>
    - Reference
      - <https://github.com/grpc/grpc-go>
- Data Partitioning
  - Range vs Hash
    - <https://tikv.org/docs/deep-dive/scalability/data-sharding/>
  - Partitioning of DynamoDB (Optional)
    - <https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf>
    - <https://dzone.com/articles/partitioning-behavior-of-dynamodb>
  - Partitioning of TiKV
    - <https://pingcap.com/blog/2017-07-11-tidbinternal1/>
- Replication & Consistency
  - Reading Materials
    - Database Internals: 11. Replication and Consistency
  - CAP vs PACELE
    - <http://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf>
  - Clock and Time
    - <https://dzone.com/articles/tick-or-tock-keeping-time-and-order-in-distributed-1>
  - Consistency
    - <https://arxiv.org/pdf/1902.03305.pdf>
- Consensus
  - Quorum
    - <https://en.wikipedia.org/wiki/Quorum_(distributed_computing)>
  - Paxos (Optional)
    - Reading Materials
      - Database Internals: 14. Consensus @ Paxos
    - Reference
      - <https://lamport.azurewebsites.net/pubs/paxos-simple.pdf>
  - Raft
    - Reading Materials
      - Database Internals: 14. Consensus @ Raft
    - Reference
      - <https://raft.github.io/>
      - <https://pdos.csail.mit.edu/6.824/labs/lab-raft.html>
- Scale & Balance
  - Multi-Raft
    - <https://tikv.org/deep-dive/scalability/multi-raft/>
  - Split & Merge
    - <https://pingcap.com/blog/tidb-internal-scheduling/>
  - Balance
    - <https://pingcap.com/blog/tidb-internal-scheduling/>
- Distributed Transactions
  - Reading Materials
    - Database Internals: 5. Transaction Processing and Recovery
    - Database Internals: 13. Distributed Transactions
  - ACID
    - <https://en.wikipedia.org/wiki/ACID>
  - Isolation (Optional)
    - <https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-95-51.pdf>
    - <https://www.jianshu.com/p/3673e612cce2> (Chinese)
  - Spanner (Optional)
    - <https://storage.googleapis.com/pub-tools-public-publication-data/pdf/45855.pdf>
    - <https://www.jianshu.com/p/f307bd2023f5> (Chinese)
  - Percolator
    - <https://tikv.org/docs/deep-dive/distributed-transaction/percolator/>
    - <https://tikv.org/docs/deep-dive/distributed-transaction/optimized-percolator/>
- Coprocessor (Optional)
  - <https://blogs.apache.org/hbase/entry/coprocessor_introduction>
  - <https://zhuanlan.zhihu.com/p/89518391> (Chinese)
- Benchmark & Testing
  - sysbench (Optional)
    - <https://github.com/akopytov/sysbench>
    - <https://www.percona.com/blog/2019/04/25/creating-custom-sysbench-scripts/>
    - <https://www.jianshu.com/p/30933e0bebe7> (Chinese)
  - go-tpc (Optional)
    - <https://github.com/pingcap/go-tpc>
  - go-ycsb
    - <https://github.com/pingcap/go-ycsb>
    - <https://medium.com/@siddontang/use-go-ycsb-to-benchmarkdifferent-databases-8850f6edb3a7>
    - <https://www.jianshu.com/p/73d22befe47d> (Chinese)
  - Chaos
    - <https://principlesofchaos.org/>
    - <https://pingcap.com/blog/chaos-practice-in-tidb/>
    - <https://medium.com/@siddontang/use-chaos-to-test-the-distributed-system-linearizability-4e0e778dfc7d>

