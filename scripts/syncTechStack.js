// scripts/syncTechStack.js
import { Client } from "@notionhq/client";
import fs from "node:fs";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dbList = process.env.NOTION_DB_LIST;

if (!process.env.NOTION_TOKEN || !dbList) {
  console.error("❌ NOTION_TOKEN 또는 NOTION_DB_LIST가 설정되지 않았습니다.");
  process.exit(1);
}

const databaseIds = dbList.split(",").map((id) => id.trim());

// JSON 파일에서 옵션 불러오기
const payload = JSON.parse(fs.readFileSync("data/tech-options.json", "utf8"));
const options = payload["기술스택"];

if (!Array.isArray(options)) {
  console.error("❌ tech-options.json 내에 '기술스택' 배열이 없습니다.");
  process.exit(1);
}

async function syncDatabase(databaseId) {
  try {
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        "기술스택": {
          type: "multi_select",
          multi_select: { options }
        }
      }
    });
    console.log(`✅ Synced ${options.length} options to DB: ${databaseId}`);
  } catch (error) {
    console.error(`❌ Failed to sync DB: ${databaseId}`, error.body || error);
  }
}

async function main() {
  for (const dbId of databaseIds) {
    await syncDatabase(dbId);
  }
}

main().catch((e) => {
  console.error("❌ Unexpected error:", e);
  process.exit(1);
});
