---
title: "TinyKV Lab3B：Region Split 后的状态收敛问题"
date: "2026-06-02 10:02:00"
updated: "2026-06-02 10:00:00"
permalink: "2026/06/02/tinykv-lab3b-region-split-state-convergence/"
categories:
  - "分布式系统"
tags:
  - "TinyKV"
  - "分布式系统"
  - "Raft"
  - "Region Split"
  - "问题复盘"
---

> 本文整理自本地 TinyKV 项目文件：`tinykv-understanding/labs/lab3b-split-heartbeat-difficulty.md`。
> 系列顺序：[TinyKV Lab 路线图](/2026/06/02/tinykv-lab-roadmap/) -> [TinyKV Lab1：StandaloneKV](/2026/06/02/tinykv-lab1-standalonekv/) -> [TinyKV Lab2：RaftKV](/2026/06/02/tinykv-lab2-raftkv/) -> [TinyKV Lab3：Multi-RaftKV](/2026/06/02/tinykv-lab3-multiraftkv/) -> [TinyKV Lab3B：Region Split 后的状态收敛问题](/2026/06/02/tinykv-lab3b-region-split-state-convergence/) -> [TinyKV Lab4：Transactions](/2026/06/02/tinykv-lab4-transactions/) -> [TinyKV 测试指南](/2026/06/02/tinykv-testing-guide/)。

这份记录整理的是我们在 Lab3B 实现 `Region Split`、`ChangePeer`、snapshot recovery 相关逻辑时遇到的几个问题。它们表面上出现在不同测试里，但本质都和 raftstore 在 split/conf change 之后的状态收敛有关。

## 问题目录

| 编号 | 问题 | 根因总结 | 典型现象 | 修复位置 |
| --- | --- | --- | --- | --- |
| 1 | split 后 scheduler 短暂找不到右半边 region | split apply 后只立即上报了 left region，right region 依赖后续异步 heartbeat，导致 scheduler 暂时出现 range gap | `panic: find no region for "3 00000000"` | `applySplit` 中同时上报 left/right |
| 2 | 被移除的 peer 继续 apply 后续 committed entries | `RemoveNode` 删除自己后 peer 已经 destroy，但同一个 `Ready` 中剩余 committed entries 仍被继续 apply，可能破坏 raft/apply 状态一致性 | `unexpected raft log index: lastIndex 0 < appliedIndex ...` | `HandleRaftReady` 每次 `applyEntry` 后检查 `d.stopped` |
| 3 | 用 left region 访问 right key 时没有稳定返回 `KeyNotInRegion` | 普通 KV 请求只在 apply 阶段检查 key range，请求已经进入 Raft 后才发现越界，错误返回受 commit/apply 时序影响 | `TestOneSplit3B` 中 expected `KeyNotInRegion`，但 header error 为 `nil` | `preProposeRaftCommand` 对普通 KV 请求提前检查 key range |

<!-- more -->

## 背景

Lab3B 的目标之一是让 raftstore 支持 `Region Split`。split 前，一个 region 覆盖一整段 key range：

```text
old region: [start, end)
```

split 后，需要变成两个相邻 region：

```text
left region:  [start, splitKey)
right region: [splitKey, end)
```

其中 left region 沿用旧 region id，right region 使用 scheduler 分配的新 region id 和新 peer ids。

本地 raftstore 在 apply split log 时，需要同时完成几件事：

1. 更新 left region 的 end key 和 epoch。
2. 创建 right region 元信息。
3. 持久化 left/right 两个 `RegionLocalState`。
4. 更新本 store 的 `storeMeta.regionRanges` 和 `storeMeta.regions`。
5. 创建并注册 right region 对应的 new peer。
6. 把 split 后的新 region 信息告诉 scheduler。

后面三个问题都和这些状态更新的顺序有关：本地状态、scheduler 缓存、peer 生命周期、请求入口检查必须互相配合，否则就会出现很短但足以让测试失败的时序窗口。

## 问题一：split 后 scheduler 出现 range gap

### 先点明原因

这个问题出现的原因是：split apply 完成后，我们只同步向 scheduler 上报了 left region，而 right region 要等 new peer 后续启动、选主、定时 heartbeat 之后才会被 scheduler 看到。

于是 scheduler 先删除 old region 并插入 left region，但 right region 还没进来，中间就短暂缺失了 `[splitKey, end)` 这段 range。

### 具体现象

多次运行 Lab3B 测试时，曾经遇到过：

```text
TestSplitConfChangeSnapshotUnreliableRecoverConcurrentPartition3B:
  panic: find no region for 33203030303030303030
  即 key "3 00000000" 在 scheduler 中找不到对应 region
```

这个失败不是每次稳定复现，而是多跑几次才出现。说明 split 功能不是完全没做，而是 split 后的新 region 信息发布存在时序窗口。

### 详细分析

最初的实现逻辑大概是：

```go
d.ctx.router.register(newPeer)
newPeer.MaybeCampaign(parentWasLeader)
_ = d.ctx.router.send(right.GetId(), message.Msg{Type: message.MsgTypeStart})

if parentWasLeader {
	d.HeartbeatScheduler(d.ctx.schedulerTaskSender)
}
```

这里 `d.HeartbeatScheduler(...)` 只能上报 `d.Region()`。split apply 之后，当前 peer 已经变成 left region，所以 scheduler 会先收到：

```text
left region: [start, splitKey)
```

right region 虽然已经创建了 `newPeer`，但它后续要经过异步流程：

```text
newPeer start
right region election
right peer 成为 leader
scheduler heartbeat tick 到来
right region heartbeat 发给 scheduler
```

这些步骤不是同步完成的。因此会出现下面这个窗口：

```text
1. scheduler 原本知道 old region:
   [start, end)

2. split leader 先上报 left region:
   [start, splitKey)

3. MockScheduler 发现 left 和 old region range overlap，
   会删除 old region，再插入 left region。

4. right region:
   [splitKey, end)
   还没有 heartbeat 到 scheduler。

5. scheduler 暂时只知道:
   [start, splitKey)

   于是 [splitKey, end) 这段 key range 出现短暂空洞。
```

这就是 `find no region for "3 00000000"` 的直接原因：这个 key 落在右半边，但 scheduler 暂时还没有收到 right region 的 heartbeat。

### 为什么不是 MockScheduler 的问题

测试用的 `MockScheduler` 在收到新 region heartbeat 时，如果发现 range 和旧 region overlap，会删除旧 region，再插入新 region。

这个行为是测试框架原有逻辑。它暴露了问题，但不是我们要优先修改的对象。真正的问题是 raftstore split apply 阶段没有把 left/right 两个 split 结果作为一个完整状态及时发布出去。我们只发布了 left，导致 scheduler 在等待 right heartbeat 的期间短暂缺少右半边 range。

### 修复方法

修复核心是：split apply 完成后，leader 要主动把 left 和 right 两个 region 都上报给 scheduler。

可以在 `peer_msg_handler.go` 中新增一个 helper，让它和 `peer.HeartbeatScheduler` 做类似的事，但允许显式指定 region 和 peer：

```go
func (d *peerMsgHandler) notifyHeartbeatScheduler(region *metapb.Region, peer *peer) {
	if region == nil || peer == nil {
		return
	}

	clonedRegion := new(metapb.Region)
	if err := util.CloneMsg(region, clonedRegion); err != nil {
		return
	}

	d.ctx.schedulerTaskSender <- &runner.SchedulerRegionHeartbeatTask{
		Region:          clonedRegion,
		Peer:            peer.Meta,
		PendingPeers:    peer.CollectPendingPeers(),
		ApproximateSize: peer.ApproximateSize,
	}
}
```

然后把 split apply 末尾的单次 heartbeat：

```go
if parentWasLeader {
	d.HeartbeatScheduler(d.ctx.schedulerTaskSender)
}
```

改成同时通知 left 和 right：

```go
if parentWasLeader {
	d.notifyHeartbeatScheduler(left, d.peer)
	d.notifyHeartbeatScheduler(right, newPeer)
}
```

这里保留 `parentWasLeader` 判断很重要。只有 split 前的 leader 才应该主动向 scheduler 上报 leader heartbeat；follower apply split 时不应该把自己当作 leader 上报。

### 为什么这个修复有效

这个修复把 split 后的 scheduler 可见状态从：

```text
先看到 left
过一段时间再看到 right
```

变成：

```text
split apply 时连续看到 left 和 right
```

这样即使 MockScheduler 在处理 left heartbeat 时会删除 old region，right heartbeat 也会紧接着补上右半边 range，大幅缩短甚至消除 scheduler range gap。

更重要的是，right region 不再完全依赖后续的 election 和定时 scheduler heartbeat tick 才能被 scheduler 发现。

### 公开实现中的类似做法

查阅多个公开 TinyKV 完成版后，可以看到成熟实现普遍会在 split 后主动通知 scheduler 两个 region：

- JiaweiHH/TinyKV：split 后先上报当前 region，再调用 `notifyHeartbeatScheduler(newRegion, peer)`。
  https://github.com/JiaweiHH/TinyKV/blob/dee43eb66779ac1e817f67d797b35637eeaf22fc/kv/raftstore/peer_msg_handler.go#L285-L289
- sakura-ysy/TinyKV-2022-doc：注释中明确写了刷新 scheduler 的 region 缓存，并连续上报当前 region 和 new region。
  https://github.com/sakura-ysy/TinyKV-2022-doc/blob/fffa4783efc76eb3071f24d3802312586b7114c0/tinykv/kv/raftstore/peer_msg_handler.go#L473-L475
- XLOverflow/tinykv：在 split 后注释为通知 scheduler 两个 region，并分别上报 old/new region。
  https://github.com/XLOverflow/tinykv/blob/40184275515e540901a139c16a4b12efe6c2d0ec/kv/raftstore/peer_msg_handler.go#L393-L401

这些实现的共同点是：不只依赖 right peer 后续自己的周期 heartbeat，而是在 split apply 的关键路径里立即补齐 right region 的 scheduler heartbeat。

## 问题二：被移除的 peer 继续 apply 后续日志

### 先点明原因

这个问题出现的原因是：`HandleRaftReady` 会一次性处理当前 `Ready` 里的多个 committed entries。如果其中某条 conf change 日志把当前 peer 自己 remove 掉，peer 已经被 destroy 并设置为 stopped，但原来的循环还可能继续 apply 同一个 `Ready` 中后面的 entries。

peer 被 destroy 后就不应该再处理任何日志。继续 apply 会让本地 `applyState.AppliedIndex` 和 raft log 状态脱节，重启或重新创建 peer storage 时就可能触发 `lastIndex < appliedIndex` 的 panic。

### 具体现象

之前多轮跑复杂的 split/conf change/snapshot 测试时，曾经出现过类似错误：

```text
unexpected raft log index: lastIndex 0 < appliedIndex 52
```

这个 panic 来自 `kv/raftstore/peer_storage.go` 中的初始化检查：

```go
if raftState.LastIndex < applyState.AppliedIndex {
	panic(fmt.Sprintf("%s unexpected raft log index: lastIndex %d < appliedIndex %d",
		tag, raftState.LastIndex, applyState.AppliedIndex))
}
```

这条检查的含义是：一个 peer 的 raft log 至少要覆盖已经 apply 到的 index。否则说明本地状态不一致：apply state 说自己已经 apply 到更后面的位置，但 raft state 里没有对应日志。

### 详细分析

`HandleRaftReady` 中的处理流程是：

```go
rd := d.RaftGroup.Ready()
d.peerStorage.SaveReadyState(&rd)
d.Send(d.ctx.trans, rd.Messages)

for _, entry := range rd.CommittedEntries {
	d.applyEntry(entry)
}

d.RaftGroup.Advance(rd)
```

问题在 `for _, entry := range rd.CommittedEntries` 这一段。

对于普通日志，循环继续 apply 是正常的；但对于 conf change 日志，情况特殊。如果这条日志是 `RemoveNode`，并且删除的是当前 peer 自己，那么 apply conf change 后会进入 destroy 流程：

```text
apply ChangePeer(RemoveNode self)
更新 region peers
ApplyConfChange 修改 Raft 内部成员表
destroy 当前 peer
router close 当前 region
d.stopped = true
从 storeMeta.regions / regionRanges 删除当前 region
```

此时这个 peer 在逻辑上已经不属于该 region。它的本地状态已经进入 tombstone/destroy 状态，后续消息和 tick 也应该被忽略。

如果同一个 `Ready` 中还有后续 committed entries，而循环没有停下来，就可能继续做这些事：

```text
继续 apply normal/admin request
继续 persistApplyState
继续推进 AppliedIndex
可能继续改 KV 或 region meta
```

这会造成危险的不一致：

```text
raft log/local raft state 已经因为 destroy 或重建变成空/较小
applyState.AppliedIndex 却被后续 entry 推进到更大
```

等测试重启节点、重新加载 peer storage 时，就会读到：

```text
raftState.LastIndex = 0
applyState.AppliedIndex = 52
```

于是触发：

```text
lastIndex 0 < appliedIndex 52
```

这不是 `PeerStorage` 检查太严格，而是它正确发现了本地 raft/apply 状态已经不一致。

### 修复方法

修复点是在 `HandleRaftReady` 的 committed entries 循环中，每 apply 完一条 entry 后立刻检查当前 peer 是否已经 stopped：

```go
for _, entry := range rd.CommittedEntries {
	d.applyEntry(entry)
	if d.stopped {
		return
	}
}
```

这样如果某条 conf change 删除了自己，后面的 committed entries 就不会再被这个已经 destroy 的 peer 处理。

### 为什么这个修复有效

`d.stopped` 是 peer 生命周期的边界。进入 stopped 后，这个 peer 已经从 router 和 storeMeta 中移除，不再是一个可以继续服务请求、apply 日志、推进 apply state 的正常 peer。

因此停止处理后续 entries 是正确的。它避免了 destroy 后继续写 `applyState`，也就避免了重启时出现 `raftState.LastIndex < applyState.AppliedIndex`。

## 问题三：越界 KV 请求没有稳定返回 KeyNotInRegion

### 先点明原因

这个问题出现的原因是：普通 KV 请求原来只在 apply 阶段检查 key 是否属于当前 region。也就是说，请求要先进入 Raft、被 commit、再被 apply，才会发现 key 已经落到 split 后的另一个 region。

但测试期望的是：客户端拿 left region 去访问 right key 时，left leader 应该尽快返回 `KeyNotInRegion`。如果错误要等到 Raft commit/apply 才返回，就容易被 split、leader、callback 的时序影响，测试里可能看到 header error 为 `nil`。

### 具体现象

`TestOneSplit3B` 中曾经出现过：

```text
TestOneSplit3B:
  期望返回 KeyNotInRegion
  实际 response header error 为 nil
```

测试逻辑大致是：

```text
1. 写入数据，触发 region split。
2. 从 scheduler 中拿到 left region 和 right region。
3. 故意用 left region 去读 right region 中的 key。
4. 期望 raftstore 立刻拒绝这个请求，返回 KeyNotInRegion。
```

如果 raftstore 没有在 propose 前检查 key range，请求就可能先进入 Raft。进入 Raft 后，错误返回会依赖后续 commit/apply 时机，不再是一个入口处的同步拒绝。

### 详细分析

已有的 apply 阶段 key check 是必要的，例如：

```go
case raft_cmdpb.CmdType_Get:
	get := request.GetGet()
	if err := util.CheckKeyInRegion(get.Key, d.Region()); err != nil {
		BindRespError(resp, err)
		break
	}
```

这段检查能处理一种重要情况：

```text
请求 propose 时 key 还在当前 region
请求进入 Raft
在 apply 前 region split 了
apply 时 key 已经不属于当前 region
```

所以 apply 阶段检查必须保留。

但只在 apply 阶段检查还不够。对于已经完成 split 的 left leader，如果收到一个明显属于 right region 的 key，请求不应该再进入 Raft。否则会出现两类问题：

```text
1. 错误返回变慢：
   需要等待 Raft propose、commit、apply 后才返回 KeyNotInRegion。

2. 错误返回受时序影响：
   split、选主、callback 超时、请求路由更新交织在一起时，
   测试可能拿不到稳定的 KeyNotInRegion。
```

因此，普通 KV 请求需要在进入 Raft 前也做一次 key range 检查。

### 修复方法

修复点放在 `preProposeRaftCommand` 里。这个函数本来就是请求进入 Raft 前的合法性检查入口，已经负责检查：

```text
store id
leader
peer id
term
region epoch
```

在这些检查之后，对非 admin 请求补充 key range 检查：

```go
if req.GetAdminRequest() == nil {
	for _, r := range req.GetRequests() {
		var key []byte
		switch r.GetCmdType() {
		case raft_cmdpb.CmdType_Get:
			key = r.GetGet().GetKey()
		case raft_cmdpb.CmdType_Put:
			key = r.GetPut().GetKey()
		case raft_cmdpb.CmdType_Delete:
			key = r.GetDelete().GetKey()
		}

		if key != nil {
			if err := util.CheckKeyInRegion(key, d.Region()); err != nil {
				return err
			}
		}
	}
}
```

这样请求如果一开始就不属于当前 region，会在 propose 前直接返回错误：

```text
client request
preProposeRaftCommand
CheckKeyInRegion failed
cb.Done(ErrResp(err))
不会进入 Raft log
```

### 为什么还要保留 apply 阶段检查

propose 前检查和 apply 阶段检查解决的是两个不同窗口：

```text
propose 前检查：
  防止已经越界的请求进入 Raft。

apply 阶段检查：
  防止请求 propose 后、apply 前 region 又发生 split。
```

所以不能因为加了 propose 前检查就删掉 apply 阶段检查。两个检查一起存在，才能覆盖 split 前后两个时序窗口。

## 为什么这些问题发生在 Lab3B

这次失败出现在 `project3b`，因为 Lab3B 的测试直接使用 `kv/test_raftstore` 里的 mock scheduler，重点测试 raftstore 的：

```text
ChangePeer
TransferLeader
Region Split
Snapshot recovery
partition / unreliable network
```

Lab3C 改的是真正的 scheduler server，比如 `scheduler/server/...`，而 `project3b` 的这些测试并不依赖 Lab3C 的 scheduler 实现。所以这些问题更像是 Lab3B 的 raftstore split/conf change 逻辑引入的，而不是 Lab3C scheduler 逻辑导致的。

## 验证方式

修复后，优先跑之前失败的两个测试多轮：

```bash
go test -v --count=1 --parallel=1 -p=1 -timeout 20m ./kv/test_raftstore -run '^TestOneSplit3B$'
go test -v --count=1 --parallel=1 -p=1 -timeout 20m ./kv/test_raftstore -run '^TestSplitConfChangeSnapshotUnreliableRecoverConcurrentPartition3B$'
```

我们最近一次针对性验证结果是：

| 测试 | 结果 |
| --- | --- |
| `TestOneSplit3B` | 10/10 PASS |
| `TestSplitConfChangeSnapshotUnreliableRecoverConcurrentPartition3B` | 10/10 PASS |

同时没有再在日志中看到这些旧症状：

```text
find no region
region is not split
unexpected raft log index
panic
FAIL
```

之后再跑完整 Lab3B：

```bash
make project3b
make project3b
```

需要注意，`project3b` 的 Makefile 中部分子测试后面可能带有 `|| true`，所以不能只看最终退出码。要检查输出里是否还有 `FAIL`、`panic` 或上面列出的旧症状。

## 总结

这几个困难本质上都是状态边界没有处理完整：

```text
split 后：
  scheduler 必须尽快同时看到 left/right。

remove self 后：
  当前 peer 必须立刻停止继续 apply。

普通 KV 请求进入 Raft 前：
  必须确认 key 仍属于当前 region。
```

正确方向不是修改原有 MockScheduler，也不是放宽 `PeerStorage` 的一致性检查，而是在 Lab3B 的 raftstore 逻辑中把这些边界补完整。这样 split/conf change/snapshot 交织在一起时，系统仍然能保持 region range、peer 生命周期和 raft/apply 状态的一致性。
