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
  try {
    // DB 조회 (ID/권한 검증)
    const info = await notion.databases.retrieve({ database_id: databaseId });
    const title = info.title?.[0]?.plain_text ?? "(no title)";
    console.log(`🔎 DB 확인: ${databaseId} | title="${title}"`);

    // 속성 존재 여부
    if (!info.properties) {
      console.error(`❌ DB properties not found for: ${databaseId}`);
      return false;
    }
    
    // 모든 속성 키 출력 (디버깅용)
    console.log(`📋 Available properties:`, Object.keys(info.properties));
    
    // 속성 이름 정규화 (공백 제거, 대소문자 무시)
    const normalizedPropName = PROPERTY_NAME.trim();
    const propertyKeys = Object.keys(info.properties);
    const matchingKey = propertyKeys.find(key => 
      key.trim() === normalizedPropName || 
      key.replace(/\s/g, '') === normalizedPropName.replace(/\s/g, '')
    );
    
    if (!matchingKey) {
      console.warn(`⚠️ "${PROPERTY_NAME}" 속성이 없음 → Notion에서 먼저 생성 필요`);
      console.log(`   찾은 속성들: ${propertyKeys.join(', ')}`);
      return false;
    }
    
    const prop = info.properties[matchingKey];
    console.log(`🔍 Found property "${matchingKey}" with type: ${prop.type}`);
    
    if (prop.type !== "multi_select") {
      console.warn(`⚠️ "${matchingKey}"는 '${prop.type}' 타입 → 'multi_select'로 변경 필요`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Preflight failed for DB: ${databaseId}`, error);
    if (error.body) {
      console.error(`   Error details:`, error.body);
    }
    return false;
  }
}


async function syncDatabase(databaseId) {
  try {
    // DB 정보 가져오기
    const info = await notion.databases.retrieve({ database_id: databaseId });
    
    // 속성 이름 매칭 (공백/대소문자 무시)
    const normalizedPropName = PROPERTY_NAME.trim();
    const propertyKeys = Object.keys(info.properties || {});
    const matchingKey = propertyKeys.find(key => 
      key.trim() === normalizedPropName || 
      key.replace(/\s/g, '') === normalizedPropName.replace(/\s/g, '')
    );
    
    // Preflight 체크
    const preflightPassed = await preflight(databaseId, notion);
    
    if (!preflightPassed) {
      console.error(`❌ Preflight check failed for DB: ${databaseId}`);
      console.log(`📝 Please ensure "${PROPERTY_NAME}" property exists as multi-select type in Notion database`);
      return;
    }
    
    // 실제 속성 키 사용 (찾은 매칭 키 또는 원본)
    const actualPropertyKey = matchingKey || PROPERTY_NAME;
    
    // 기존 multi-select 속성의 옵션만 업데이트
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        [actualPropertyKey]: {
          multi_select: { 
            options: options 
          }
        }
      }
    });
    console.log(`✅ Synced ${options.length} options to DB: ${databaseId} (property: "${actualPropertyKey}")`);
  } catch (error) {
    console.error(`❌ Failed to sync DB: ${databaseId}`, error.body || error.message || error);
    if (error.body) {
      console.error(`   Error details:`, JSON.stringify(error.body, null, 2));
    }
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