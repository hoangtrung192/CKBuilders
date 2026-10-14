# Week05 — Fiber trên Windows, hai node CKB Testnet

Hướng dẫn thực hành ngày 2026-10-14. **Đã chạy hai node, mở channel, payment A → B 100 CKB và cooperative close trên Testnet.** Kết quả đã kiểm tra nằm trong [báo cáo Week05](../Week05.md). Các lệnh bên dưới dành cho một lượt thực hành mới; không chạy lại installer, open channel hay payment để kiểm tra lượt đã hoàn thành.

## Bạn đang học gì?

Payment channel là một thỏa thuận có tiền bảo chứng trên chain. Hai bên mở channel bằng funding transaction, sau đó ký cập nhật số dư ngoài chain thay vì ghi từng payment lên blockchain. Khi đóng channel hoặc có tranh chấp, trạng thái được giải quyết bằng giao dịch và quy tắc trên chain. Kết nối peer chỉ tạo liên lạc; channel phải sẵn sàng và có thanh khoản trước khi payment thành công.

## Môi trường đã kiểm tra và lựa chọn

- Repo thực tế: G:\neon, origin đúng hoangtrung192/CKBuilders. Không tìm thấy AGENTS.md.
- Windows x64, Node v22.16.0; chưa thấy pnpm/OffCKB/debugger/Docker trong PATH phiên kiểm tra. WSL chưa có distro.
- Chọn **Windows native**, Fiber **v0.9.1 stable**, hai node trên **CKB Testnet**. Installer chính thức hỗ trợ Windows PowerShell 5.1+. Không cần pnpm hoặc WSL cho chặng này.
- v0.10.0-rc1 là prerelease, không dùng cho bài này. v0.9.1 được GitHub công bố ngày 2026-09-11; version máy bạn phải được kiểm tra sau cài đặt.
- RPC CKB của Fiber: https://testnet.ckbapp.dev/ (template chính thức). RPC 127.0.0.1:8114 là OffCKB Devnet của Week03/04; không thay Testnet endpoint bằng endpoint đó vì FundingLock/CommitmentLock/dependencies Testnet không tự có trên Devnet.
- Nếu native Windows không khởi động được, giữ nguyên state và gửi lỗi. WSL2/Ubuntu là phương án dự phòng, chưa có lệnh cài/khởi động WSL được thực hiện.

| Node | Thư mục riêng | Fiber RPC | P2P |
| --- | --- | --- | --- |
| A | G:\neon\week5\fiber\.local\nodeA | 127.0.0.1:8227 | 127.0.0.1:8228 |
| B | G:\neon\week5\fiber\.local\nodeB | 127.0.0.1:8237 | 127.0.0.1:8238 |

Không copy key, fiber/sk, store hay backup từ A sang B. Dùng hai account mới và hai password riêng. Thư mục .local và tools đã được ignore trong week5/.gitignore. Key Week03 hiện có vẫn giữ nguyên.

## Chặng 1 — cài node A, kiểm tra phiên bản

**Terminal Setup: PowerShell thường, không cần Administrator; thư mục G:\neon.**

```powershell
Set-Location G:\neon
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\week5\fiber\Install-FiberTestnetNode.ps1 -Node A
```

Script tải và chạy installer chính thức từ tag v0.9.1 trong child PowerShell, chỉ rõ `-Network testnet`, fnn 0.9.1 và ckb-cli 1.12.0. Nó từ chối nếu thư mục nodeA đã tồn tại để không backup/move hoặc ghi đè node cũ.

Trong installer:

1. Chọn **1 — Create a new CKB account**. Không import a.key/b.key của Week03.
2. Nhập wallet password theo prompt ckb-cli. Đối chiếu lock_arg của account vừa tạo với `Detected lock_arg`; nếu lệch, dừng và gửi output công khai để kiểm tra.
3. Ghi địa chỉ **Testnet ckt1...**; không gửi key hoặc seed. Wallet password và FIBER_SECRET_KEY_PASSWORD có vai trò khác nhau; lưu riêng trong password manager.
4. Ở `Would you like to start the node now?` chọn **n**. Cần chỉnh port/policy trước khi chạy. Nếu RPC preflight không thành công, installer có thể bỏ qua prompt khởi động; giữ thư mục và gửi lỗi, không chạy installer lần nữa.
5. Không lưu password vào profile, script hay ảnh. Lần khởi động đầu node sẽ hỏi FIBER_SECRET_KEY_PASSWORD và dùng nó để mã hóa key.

Sau khi cài xong:

```powershell
Set-Location G:\neon
& .\week5\fiber\.local\nodeA\fnn.exe --version
& .\week5\fiber\.local\nodeA\fnn-cli.exe --version
& .\week5\fiber\.local\nodeA\ckb-cli.exe --version
Select-String -Path .\week5\fiber\.local\nodeA\config.yml -Pattern '^\s+chain:', '^\s+rpc_url:'
```

Mong đợi fnn/fnn-cli **0.9.1**, chain **testnet**, rpc_url **https://testnet.ckbapp.dev/**. Installer có thể tái sử dụng ckb-cli đã có trong PATH; nếu không có ckb-cli.exe ở nodeA, chạy `Get-Command ckb-cli` và dùng đường dẫn thực tế, ghi version. Nếu version/config khác, dừng trước chặng 2.

**Evidence:** chụp version/config, lưu `G:\neon\week5\evidence\fiber\01-versions.png`. Đây là checkpoint đầu tiên để follow up.

## Chặng 2 — node B, port riêng và tiền Testnet

**Terminal Setup, G:\neon; tiếp tục sau khi chặng 1 đạt yêu cầu.**

```powershell
Set-Location G:\neon
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\week5\fiber\Install-FiberTestnetNode.ps1 -Node B
& .\week5\fiber\.local\nodeB\fnn.exe --version
& .\week5\fiber\.local\nodeB\fnn-cli.exe --version
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\week5\fiber\Set-FiberTestnetPorts.ps1 -Node A
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\week5\fiber\Set-FiberTestnetPorts.ps1 -Node B
```

Chọn account mới cho B, chọn **n** khi hỏi start. Script cấu hình giữ bản config gốc, dùng RPC/P2P loopback, tắt auto-accept channel để bạn tự thực hành bước accept, giữ nguyên script hashes và dependencies trong template đúng tag. Chỉ chạy trước khi node khởi động; nếu đã có backup/config tùy chỉnh, script dừng để kiểm tra.

Vào [CKB Testnet faucet](https://faucet.nervos.org/) và nạp **ít nhất 1.000 Testnet CKB cho từng địa chỉ A/B**. Bài này mỗi bên funding 500 CKB; vẫn cần capacity cho change và phí. CKB Devnet Week03 không dùng được trên Testnet.

Kiểm tra capacity sau khi faucet committed. Chạy lần lượt và nhập lock_arg công khai đúng account:

```powershell
$lockArgA = Read-Host 'Lock arg cua account A (cong khai)'
$lockArgB = Read-Host 'Lock arg cua account B (cong khai)'
& .\week5\fiber\.local\nodeA\ckb-cli.exe --url https://testnet.ckbapp.dev/ wallet get-capacity --lock-arg $lockArgA
& .\week5\fiber\.local\nodeB\ckb-cli.exe --url https://testnet.ckbapp.dev/ wallet get-capacity --lock-arg $lockArgB
```

Nếu installer dùng ckb-cli có sẵn, thay đường dẫn exe bằng đường dẫn từ Get-Command. **Evidence:** hai địa chỉ khác nhau, capacity sau faucet → `02-funding.png`. Không mở channel nếu thiếu capacity.

## Chặng 3 — chạy hai node

**Terminal Node A: PowerShell riêng, giữ mở.**

```powershell
Set-Location G:\neon\week5\fiber\.local\nodeA
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-node.ps1
```

**Terminal Node B: PowerShell thứ hai, giữ mở.**

```powershell
Set-Location G:\neon\week5\fiber\.local\nodeB
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-node.ps1
```

Nhập password mã hóa key khi hỏi; lần khởi động sau phải dùng đúng password đó. Dùng Ctrl+C để dừng node sạch; giữ toàn bộ state.

**Terminal Control: PowerShell thứ ba, G:\neon.** Dùng terminal này xuyên suốt các bước RPC tiếp theo; mở terminal mới thì dot-source lại helper và đọc lại biến từ kết quả đã lưu.

```powershell
Set-Location G:\neon
. .\week5\fiber\Fiber-Rpc.ps1
$infoA = Invoke-FiberRpc -Node A -Method node_info
$infoB = Invoke-FiberRpc -Node B -Method node_info
$infoA | ConvertTo-Json -Depth 20
$infoB | ConvertTo-Json -Depth 20
Export-FiberEvidence -Name '03-nodes' -Data @{ A = $infoA; B = $infoB }
```

Helper tự kiểm tra chain_hash Testnet trước mọi RPC Fiber; nếu sai network thì dừng. Cần hai pubkey khác nhau, đúng hai port, cùng chain_hash Testnet. **Evidence:** `03-two-nodes.png` và JSON tương ứng. Khởi động thành công chưa có nghĩa là đã mở channel.

## Chặng 4 — kết nối peer

**Terminal Control, G:\neon.**

```powershell
Invoke-FiberRpc -Node A -Method connect_peer -Parameters @{ address = '/ip4/127.0.0.1/tcp/8238' }
$peersA = Invoke-FiberRpc -Node A -Method list_peers
$peersB = Invoke-FiberRpc -Node B -Method list_peers
$peersA | ConvertTo-Json -Depth 15
$peersB | ConvertTo-Json -Depth 15
Export-FiberEvidence -Name '04-peers' -Data @{ A = $peersA; B = $peersB }
```

Kiểm tra peers A chứa `$infoB.pubkey`, peers B chứa `$infoA.pubkey`. `connect_peer` trả về không lỗi chưa đủ; đợi list_peers xác nhận. **Evidence:** `04-peers.png`.

## Chặng 5 — mở và accept channel

Bạn học sự khác nhau giữa đề nghị channel, funding transaction và channel sẵn sàng. **Terminal Control:**

```powershell
$opened = Invoke-FiberRpc -Node A -Method open_channel -Parameters @{ pubkey = $infoB.pubkey; funding_amount = '0xba43b7400'; public = $true }
$opened | ConvertTo-Json -Depth 15
Export-FiberEvidence -Name '05-open' -Data $opened
$accepted = Invoke-FiberRpc -Node B -Method accept_channel -Parameters @{ temporary_channel_id = $opened.temporary_channel_id; funding_amount = '0xba43b7400' }
$accepted | ConvertTo-Json -Depth 15
Export-FiberEvidence -Name '05-accept' -Data $accepted
```

`0xba43b7400` = 50.000.000.000 shannons = **500 CKB** mỗi bên. Không gọi lại open_channel để chờ; việc đó có thể mở thêm channel. temporary_channel_id là ID lúc thương lượng, chưa phải kết quả channel cuối.

Chạy query sau, lặp lại **query** nếu channel chưa sẵn sàng:

```powershell
$channelsA = Invoke-FiberRpc -Node A -Method list_channels -Parameters @{ pubkey = $infoB.pubkey }
$channelsB = Invoke-FiberRpc -Node B -Method list_channels -Parameters @{ pubkey = $infoA.pubkey }
$channelsA | ConvertTo-Json -Depth 25
$channelsB | ConvertTo-Json -Depth 25
```

Cần **cùng channel_id**, `state.state_name = ChannelReady` cả hai, có channel_outpoint. Lưu JSON:

```powershell
Export-FiberEvidence -Name '05-ready' -Data @{ A = $channelsA; B = $channelsB }
```

Ngoài ChannelReady, ghi funding tx hash từ log của node hoặc decode channel_outpoint theo schema OutPoint chính thức, rồi query `get_transaction` ở Testnet để lưu `tx_status.status = committed`. Không dùng một hash trong ví dụ hoặc tuần trước. Nếu chưa lấy được funding tx hash, gửi JSON channel công khai để hướng dẫn tiếp; phần committed vẫn để còn thiếu. **Evidence:** `05-channel-ready.png`.

Nếu kẹt thương lượng, xem `list_channels` với `only_pending = $true`, cùng log hai terminal. Không xóa store/key hoặc reset chain để sửa lỗi.

## Chặng 6 — invoice và một payment 100 CKB

Chỉ làm sau ChannelReady hai bên. **Terminal Control**, chọn đúng một channel vừa mở:

```powershell
$beforeA = @($channelsA.channels | Where-Object { $_.state.state_name -eq 'ChannelReady' })
$beforeB = @($channelsB.channels | Where-Object { $_.state.state_name -eq 'ChannelReady' })
if ($beforeA.Count -ne 1 -or $beforeB.Count -ne 1 -or $beforeA[0].channel_id -ne $beforeB[0].channel_id) { throw 'Can chon dung mot channel truoc khi payment.' }
Export-FiberEvidence -Name '06-before' -Data @{ A = $beforeA[0]; B = $beforeB[0] }
$beforeA[0] | ConvertTo-Json -Depth 25
$beforeB[0] | ConvertTo-Json -Depth 25
$invoice = Invoke-FiberRpc -Node B -Method new_invoice -Parameters @{ amount = '0x2540be400'; currency = 'Fibt'; description = 'CKBuilder Week05 A to B 100 CKB'; expiry = '0xe10'; hash_algorithm = 'sha256' }
$invoice | Select-Object invoice_address | ConvertTo-Json
Export-FiberEvidence -Name '06-invoice' -Data $invoice
```

`0x2540be400` = **100 CKB**; Fibt là currency Testnet; expiry = 3.600 giây. v0.9.1 tự tạo preimage ngẫu nhiên khi không truyền payment_preimage/payment_hash. Không cần in secret.

Chụp `06-before-payment.png`. Sau đó gửi **một lần**:

```powershell
$payment = Invoke-FiberRpc -Node A -Method send_payment -Parameters @{ invoice = $invoice.invoice_address }
$payment | ConvertTo-Json -Depth 15
Export-FiberEvidence -Name '07-send' -Data $payment
$paymentHash = $payment.payment_hash
```

Query trạng thái; nếu `Created`/`Inflight`, chỉ lặp query, không gửi lại:

```powershell
$paymentResult = Invoke-FiberRpc -Node A -Method get_payment -Parameters @{ payment_hash = $paymentHash }
$invoiceResult = Invoke-FiberRpc -Node B -Method get_invoice -Parameters @{ payment_hash = $paymentHash }
$paymentResult | ConvertTo-Json -Depth 15
$invoiceResult | ConvertTo-Json -Depth 20
Export-FiberEvidence -Name '07-result' -Data @{ sender = $paymentResult; receiver = $invoiceResult }
```

Cần **sender Success** và **receiver Paid** cùng payment_hash. Nếu Failed, giữ failed_error để kiểm tra, chưa đánh dấu payment thành công. Helper đã loại payment_preimage khỏi kết quả payment trước khi hiển thị/lưu. **Evidence:** `07-payment.png`.

## Chặng 7 — xác minh balance sau payment

**Terminal Control:**

```powershell
$afterA = Invoke-FiberRpc -Node A -Method list_channels -Parameters @{ pubkey = $infoB.pubkey }
$afterB = Invoke-FiberRpc -Node B -Method list_channels -Parameters @{ pubkey = $infoA.pubkey }
$afterA | ConvertTo-Json -Depth 25
$afterB | ConvertTo-Json -Depth 25
Export-FiberEvidence -Name '08-after' -Data @{ A = $afterA; B = $afterB }
```

Đối chiếu channel_id trước/sau. Chỉ lấy snapshot cuối khi ChannelReady và pending_tlcs rỗng; query lại nếu cập nhật chưa ổn định. Chuyển balance hex sang shannons rồi chia 100.000.000 để đọc CKB. A.local giảm theo amount và fee thực tế; B.local tăng 100 CKB; A.local phải khớp B.remote và ngược lại. Với kênh trực tiếp, kiểm tra fee được báo thay vì mặc định một con số. Capacity dự trữ channel không phải toàn bộ thanh khoản có thể gửi.

**Evidence:** `08-after-payment.png`, JSON before/after và payment result. Chỉ cập nhật CHECKLIST thành hoàn thành sau khi các điều kiện này đạt. Không dùng số dư wallet on-chain để thay thế balance channel off-chain.

## Follow up và nguồn đã đối chiếu

Gửi output công khai theo từng checkpoint; bắt đầu bằng **chặng 1**. Không chạy lại bước tạo account/open/payment để kiểm tra kết quả. Nếu dừng node, Ctrl+C và khởi động lại bằng start-node.ps1 với cùng password; không cài lại. Sau bài có thể học cooperative close bằng lock script thật của node, không force-close từ ví dụ; trước đó giữ state và password để khôi phục channel.

- [Native node Windows v0.9.1](https://www.fiber.world/docs/quick-start/run-a-node/rust) — hỗ trợ Windows, installer, lifecycle.
- [Release v0.9.1](https://github.com/nervosnetwork/fiber/releases/tag/v0.9.1) — stable; asset Windows fnn_v0.9.1-x86_64-windows.tar.gz đã được kiểm tra qua GitHub release API.
- [Installer đúng tag](https://github.com/nervosnetwork/fiber/blob/v0.9.1/tools/install/install.ps1) — đã đọc source; fresh-directory guard của wrapper tránh hành vi backup/move thư mục cũ.
- [Testnet template đúng tag](https://github.com/nervosnetwork/fiber/blob/v0.9.1/config/testnet/config.yml) — sử dụng dependencies nguyên bản.
- [RPC peer](https://github.com/nervosnetwork/fiber/blob/v0.9.1/crates/fiber-json-types/src/peer.rs), [channel](https://github.com/nervosnetwork/fiber/blob/v0.9.1/crates/fiber-json-types/src/channel.rs), [invoice](https://github.com/nervosnetwork/fiber/blob/v0.9.1/crates/fiber-json-types/src/invoice.rs), [payment](https://github.com/nervosnetwork/fiber/blob/v0.9.1/crates/fiber-json-types/src/payment.rs) — các trường/payload đã được đối chiếu với source v0.9.1.
- [Fiber config](https://github.com/nervosnetwork/fiber/blob/v0.9.1/crates/fiber-lib/src/fiber/config.rs) — auto_accept_channel_ckb_funding_amount=0 tắt auto accept.

Các file PowerShell tự viết đã được kiểm tra cú pháp; chủ repo đã dùng các script cài đặt/cấu hình và RPC helper trong lượt thực hành thành công với Fiber v0.9.1. Trạng thái cuối và giao dịch được đối chiếu trong [báo cáo Week05](../Week05.md). Nếu binary/help/output của một phiên bản khác thay đổi, đối chiếu tài liệu đúng tag trước khi tiếp tục.
