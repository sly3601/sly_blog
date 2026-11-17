# 私有论文与创新地图后端

这是供现有 Pages 绑定调用的独立后端，不包含任何真实论文、图片、图谱、密码或默认示例。源码可以公开；私有数据只能写入 Cloudflare Durable Object，不能生成到 Hexo、GitHub、公开图片仓库或静态构建产物。

## 接入边界

- `gateway.js` 导出 `handlePrivateWorkspace(request, env): Promise<Response|null>`。Pages 应在旧有全局 OPTIONS / CORS 分支之前调用；返回非 `null` 时直接返回该响应。它只处理 `/workspace-api` 与子路径。
- 网关需要 Pages 的 `PRIVATE_WORKSPACE` Durable Object 绑定。Pages 绑定配置使用 `class_name = "PrivateWorkspace"` 和 `script_name = "sly-private-workspace-state"`。
- `worker.js` 导出 `PrivateWorkspace`；默认 Worker fetch 仅 `/health` 返回无数据健康状态，其余一律 404，不转发到对象。配置关闭 `workers_dev`、预览 URL，不设置公开 routes。
- `wrangler.toml` 使用 `new_sqlite_classes`，以 SQLite 后端的 storage API 存储；每次请求经对象内串行队列和 storage transaction 执行。正文 JSON 和图片内部按 **64 KiB** 分块，单个 storage value 不会触及 128 KiB 限制。
- 此目录不改动现有公开博客 Worker、Pages 配置，不自动部署、建库、登录或读取任何本机资料。Pages 静态前端应与 API 同 origin，不能把私人文件放进其静态资源。

## 独立密码与会话

`GET /workspace-api/session` 返回 `{authenticated,needsSetup,csrf?}`。首次尚未设置时 `needsSetup:true`。

第一次 `POST /workspace-api/session` 提交 `{bootstrapToken,password,confirmation}`。网关恒时核对现有 `ADMIN_TOKEN`，DO 原子设置独立密码：随机 salt、PBKDF2-SHA256（100000 次）、随机 HMAC 会话密钥均留在 DO。只允许首次设置，已设置或未知版本的数据都不会被重置。以后只接受 `{password}`，旧博客 token 不再是阅读密码。允许 1–256 字符密码；简单密码本身强度较低，服务端持久限速只能降低在线猜测速度。

成功返回 `{ok:true,authenticated:true,needsSetup:false,csrf}`。签名 cookie 是 `__Host-sly-workspace`，`Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400`，24 小时失效。密码、salt、hash、HMAC key、设备 token 不写入静态源码、日志或浏览器 localStorage。签名 key 不出 DO；网关通过内部绑定验证 cookie。`DELETE /session` 撤销服务器会话并清 cookie。

密码失败计数与配对失败计数都持久保存：每客户端 15 分钟 5 次密码失败 / 8 次配对失败，另有 15 分钟 100 次全局失败上限。失败响应也提交事务，不会因抛错回滚计数。客户端只保存 CF 地址的 SHA256，不保存原始 IP。

浏览器 POST/DELETE 都要求准确同源 `Origin`；登录后写请求还要求 `X-Workspace-CSRF`。所有 API、错误、私有图响应都 `private, no-store`，不允许第三方 CORS。会话是同一位老板的不同登录，任务数据归同一固定 owner；重新登录可核对原 UUID。

## 协议

浏览器有 cookie 的请求：

- `POST /workspace-api/pair`（CSRF）：`{code,expiresAt}`，8 位码、10 分钟、仅兑换一次。
- `POST /workspace-api/rpc`（CSRF）：`{id:UUID,op,args}`。仅允许 `thesis.state`、`thesis.document`、`thesis.edit`、`thesis.importImage`、`thesis.manuscript`、`innovation.state`、`innovation.change`。
- RPC 命中缓存返回 `{status:'ready',id,result}`；未命中 HTTP 202 `{status:'pending',id}`。相同 UUID / 相同规范化 payload 接回原任务，相同 UUID / 不同 payload HTTP 409。缺失 UUID 可按原 UUID 重投，不应创建新 UUID 掩盖未知写结果。
- `GET /workspace-api/jobs/:id`：`{status:'pending'|'ready'|'error'|'uncertain',id,result?,error?}`。未登录不能读。错误与 uncertain 不会自动重排写请求。
- `GET /workspace-api/images/:sha256.ext`：已鉴权图片字节；未缓存 404。没有公开图片 URL 或存储 fallback。
- `POST /workspace-api/activity`（CSRF）：`{tabId,dirty:boolean,syncInput:boolean}`，30 秒 TTL。

桌面端：

- `POST /workspace-api/device` 提交 `{code}`，无 cookie，返回 `{token}`。代码兑换时吊销上一个设备 token；DO 只存 token hash。桌面应以 Windows 加密保存 token。
- 以下 bridge 路径必须用 `Authorization: Bearer <device token>`，不接受网页登录 cookie 代替。无 Origin 的桌面请求允许；带第三方 Origin 的请求拒绝。
- `POST /workspace-api/bridge/poll` `{lease?:jobId}` → `{jobs:[{id,op,args}],activity:boolean}`，普通 poll 一次最多领 1 项、租约 60 秒。执行时每 20 秒用 `{lease:当前id}` 续租；心跳永远不消费下一项，即使原任务刚完成或租约已过期。
- `POST /workspace-api/bridge/complete` `{id,status:'ready'|'error',result?,error?}`：相同完成结果幂等，不同结果 409。错误不自动重做。读任务过期可重新领取；写任务过期变 uncertain，不重发，但允许原 UUID 的晚到 journal 回执确认完成。
- `POST /workspace-api/bridge/publish` `{thesis?,innovation?}`：可以一次发布两份元数据。服务端白名单清洗正文目录与图谱，剔除 AI 对话、论文全文、本机路径。图谱 `snapshot.text` 是短树描述，保留。单份元数据最大 4 MiB。
- `PUT /workspace-api/bridge/images/:sha256.ext`：二进制、正确 Content-Type，PNG/JPG/JPEG/WebP/GIF 最大 20 MiB；扩展名、文件签名、SHA256 必须一致。SVG/HTML 拒绝。`thesis.document` 返回前应先上传该单区块引用的图片，不扫描或上传其他正文。

`thesis.document` 参数 `{id,version?}`，结果 `{id,version,text}`。缓存按稳定 id + version 隔离；省略 version 时从最新发布目录取当前 version，只在明确命中该版本后直接读缓存，不会自动全量下载。`thesis.edit` 完成结果更新目录缓存；`innovation.change` 完成结果更新地图缓存。`thesis.importImage` 参数 `{bytesB64,name}`，完成前须已上传对应图片；结果只保留 `{reference:'images/HASH.ext',markdown,filePath:''}`。

通用 JSON 请求最大 32 MiB、单结果 24 MiB。待处理/未确认任务最多 64 项，**所有待确认 args 合计最多 32 MiB**；超限拒收新任务，原任务和浏览器原稿保留。未知/uncertain 任务的完整 args、原 UUID 与摘要不清理。

明确完成（ready 或桌面明确 error）后立即删除大 args / bytesB64，仅保留操作类型、payload digest、完成摘要和结果引用。目录/地图操作引用最新元数据，核对旧已成功请求只刷新当前目录，不重新执行原写操作。单区块读取结果只存一份不可变 id/version 缓存，**最多 64 份且合计最多 128 MiB**；不会在每个 job 里再复制全文。版本缓存超过总字节预算时逐旧淘汰，旧 job 返回“历史读取结果已过期”，重新读取必须用新的只读 UUID，旧 UUID 永不重排。全文等其他大读取结果使用独立临时池，最多 64 份、**合计 32 MiB**；短结果上限 32 KiB，可嵌入最近任务记录。

24 小时或超出最近 256 项时可清理旧已完成任务的结果，但永久保留 UUID / payload digest / 完成摘要墓碑，绝不把旧写操作重新变成新任务。除按需图片及小型墓碑外，大文本存储预算约 208 MiB（待确认 32 + 区块缓存 128 + 临时结果 32 + 两份元数据 8 + 最近短结果约 8），不会随完成任务数叠加数百份全文。图片不擅自清理，仍会占用账号存储配额；实际免费额度以账号和 Cloudflare 当时政策为准。超配额或缺配置直接报错，没有公开存储降级。分块使用 `noCache` storage 提示，避免长期占据 DO 内存缓存。

## 离线测试

在博客根目录用项目 Node 运行：

```powershell
..\..\outputs\ai-office\tools\node.exe --test workers/private-workspace/private-workspace.test.js
```

测试使用内存 transaction storage、WebCrypto 与伪造数据，不联网、不触碰真实论文或 Cloudflare 账号。它验证权限、CSRF、密码设置/限速、会话/配对、队列幂等/租约、版本缓存、分块原子性和私有图校验；不能代替部署后本人登录的实际端到端验收。
