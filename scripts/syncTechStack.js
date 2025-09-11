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

// 상단에 추가
const PROPERTY_NAME = "기술스택"; // 필요 시 환경변수로 조정

async function preflight(databaseId, notion) {
  // DB 조회 (ID/권한 검증)
  const info = await notion.databases.retrieve({ database_id: databaseId });
  const title = info.title?.[0]?.plain_text ?? "(no title)";
  console.log(`🔎 DB 확인: ${databaseId} | title="${title}"`);

  // 속성 존재 여부
  const prop = info.properties[PROPERTY_NAME];
  if (!prop) {
    console.warn(`⚠️ "${PROPERTY_NAME}" 속성이 없음 → 이번 업데이트에서 생성됩니다.`);
  } else if (prop.type !== "multi_select") {
    console.warn(`⚠️ "${PROPERTY_NAME}"는 '${prop.type}' 타입 → 'multi_select'로 변경됩니다.`);
  }
}


async function syncDatabase(databaseId) {
  try {
    await preflight(databaseId, notion);
    
    // Notion API는 기존 속성만 수정 가능 (새 속성 추가 불가)
    // 먼저 DB 정보를 가져와서 속성 존재 여부 확인
    const database = await notion.databases.retrieve({ database_id: databaseId });
    
    if (!database.properties[PROPERTY_NAME]) {
      console.error(`❌ "${PROPERTY_NAME}" 속성이 없습니다. Notion에서 먼저 multi-select 타입으로 생성해주세요.`);
      return;
    }
    
    if (database.properties[PROPERTY_NAME].type !== "multi_select") {
      console.error(`❌ "${PROPERTY_NAME}" 속성이 multi-select 타입이 아닙니다. 현재: ${database.properties[PROPERTY_NAME].type}`);
      return;
    }
    
    // 기존 multi-select 속성의 옵션만 업데이트
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        [PROPERTY_NAME]: {
          multi_select: { 
            options: options 
          }
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
