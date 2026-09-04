# 教務處經費台帳 — 部署說明

這是一個真的會寫入 Neon PostgreSQL 資料庫的 Next.js 全端應用。資料庫（含 RLS 權限、關帳規則）已經建立並測試過，這個專案是接上去的伺服器 + 前端。

## 一、環境變數（部署到 Vercel 時要設定的兩個值）

在 Vercel 專案的 **Settings → Environment Variables** 加入：

| 變數 | 值 |
|---|---|
| `DATABASE_URL` | `postgresql://app_leader:cZCuO2pW8jHySytHSLQ3apKe2dlM@ep-lingering-smoke-a6m6axfy-pooler.us-west-2.aws.neon.tech/budget?channel_binding=require&sslmode=require` |
| `SESSION_SECRET` | `c5356affc14df8045f14bf419dc840e583613afa94e6e9c70194bd08342288d6` |

**這兩個值請當密碼保管**（例如貼到學校的密碼管理工具，不要留在 Line 群組或公開文件裡）：
- `DATABASE_URL` 裡的密碼可以連進資料庫寫入資料，但因為連線角色是 `app_leader`（不能繞過 RLS），最壞情況也只能做「登入者權限內能做的事」。
- `SESSION_SECRET` 是用來簽章登入 cookie 的，外流的話有心人可以偽造任何人的登入狀態，務必只放在 Vercel 的環境變數，不要寫進程式碼或提交到 Git。

## 二、部署到 Vercel

1. 把這個資料夾推到一個 Git repository（GitHub / GitLab 皆可），或直接把整個資料夾拖進 Vercel 的部署介面
2. 到 [vercel.com](https://vercel.com) 用學校的帳號登入，選 **Add New → Project**，指到這個 repo
3. Framework 會自動偵測為 Next.js，不用改設定
4. 加入上面兩個環境變數
5. Deploy——完成後會拿到一個 `*.vercel.app` 的網址（之後也可以在 Vercel 裡綁學校的自訂網域）

## 三、第一次登入

教務主任的帳號已經先建好：

- **Email**：`director@syjhs.tp.edu.tw`
- **臨時密碼**：`3wTFJ2E10FF1`

請主任用這組帳密登入後，點右上角「帳號管理」，就可以直接在網頁上新增四組組長的帳號（系統會產生一組臨時密碼，當場複製給組長）。目前系統還沒有「忘記密碼」或「自行改密碼」功能——如果組長密碼要換，麻煩先跟我說，我可以再加這個功能。

## 四、系統怎麼保護資料的（給資訊組參考）

- 前端**完全不知道資料庫密碼**，`DATABASE_URL` 只存在於 Vercel 伺服器端的環境變數，瀏覽器拿不到
- 每一次登入後的請求，伺服器會把「你是誰」透過資料庫的 `app.current_user_id` 這個 session 變數告訴資料庫，實際的權限判斷（誰能看誰的資料、誰能寫入）全部由資料庫的 Row Level Security 規則執行——伺服器程式本身沒有另外寫一套權限判斷邏輯，這樣才不會有「伺服器忘記檢查」的漏洞
- 密碼用 Node.js 內建的 `scrypt` 雜湊後才存進資料庫，資料庫裡看不到任何人的明文密碼
- 支出紀錄不能刪除、關帳後的計畫不能再寫入——這兩條規則是刻在資料庫的 trigger 裡，就算有人繞過這個網站直接呼叫資料庫，也一樣會被擋下

## 五、本地開發（非必要，資訊組想在本機測試時用）

```bash
npm install
cp .env.example .env.local   # 貼入上面兩個環境變數的值
npm run dev
```

## 六、目前還沒做、之後可以再加的

- 忘記密碼／自行改密碼
- 支出附上發票照片
- 餘額低於一定比例的通知信
- 年度結算報表匯出（Excel／PDF）
