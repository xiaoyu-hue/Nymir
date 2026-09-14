# ADR-001：采用 Trystero 作为 P2P 信令与连接层

- 状态：Accepted
- 日期：2026-09-08（v1.0 开发期）
- 相关：`package.json`（`@trystero-p2p/mqtt` / `@trystero-p2p/torrent`）、`src/communication/peer.ts`、[ARCHITECTURE.md](../ARCHITECTURE.md) §3

## 背景

Nymir 需要浏览器端 P2P 通信。WebRTC 只提供数据通道，Peer 发现、信令协商、STUN/TURN 均需自建。作者为零编程基础的个人开发者，无法从零实现可靠的信令协议与 NAT 穿透。

## 决策

采用 [Trystero](https://github.com/dmotz/trystero) 封装 Peer 发现与建连：运行时依赖 `@trystero-p2p/mqtt`（MQTT 通道）与 `@trystero-p2p/torrent`（WebTorrent 通道），`Strategy = 'torrent' | 'mqtt'` 可切换。Nymir 自身只维护 `PeerManager`（join/leave 回调、消息回调）与消息级加密，不实现信令协议细节。

## 后果

- **收益**：省去自建信令服务器的全部工作；MQTT + WebTorrent 双通道互为备用；Trystero 为 MIT 协议，可自由使用。
- **代价**：Peer 发现与建连元数据经过公共信令服务器（威胁模型 §5.3）；信令/建连阶段不是 E2EE 通道（README 已知局限）。这一代价由 ADR-003 明确接受。

## 替代方案

- 自建信令服务器（如 Socket.IO + 自有 TURN）：可控性最高，但引入必须长期维护的服务器，违背"无业务服务器"定位。
- Matrix/其他去中心化协议栈：能力强但体系重，学习与实现成本远超单人零基础项目。

## 相关

[ADR-003](./0003-public-signaling.md)（信令依赖的定位）、[THREAT_MODEL.md](../THREAT_MODEL.md) §4.1。
