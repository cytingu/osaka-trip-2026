# 오사카 여행 일정표 (2026.12.1 – 12.9)

링크가 있는 사람 누구나 함께 수정하는 여행 일정 사이트예요. Vercel에 올려서 써요.

- `index.html`: 일정 화면이에요. Day 카드 9개가 있고, 입력하면 자동으로 저장돼요. 다른 사람이 고친 내용은 8초마다 반영돼요.
- `api/itinerary.js`: 저장 API예요. 내용은 Upstash Redis(Vercel Marketplace)에 칸별로 저장돼서, 두 사람이 다른 칸을 동시에 고쳐도 서로 덮어쓰지 않아요.

## Vercel에 올리기

1. 이 폴더를 GitHub 저장소에 올려요.
2. Vercel에서 **Add New → Project**를 누르고 그 저장소를 **Import**해요. 프레임워크는 **Other**로 두고, 빌드 설정은 바꾸지 않아도 돼요.
3. 배포가 끝나면 프로젝트의 **Storage** 탭에서 **Upstash for Redis**를 만들고 이 프로젝트에 연결해요. 연결하면 `KV_REST_API_URL`, `KV_REST_API_TOKEN`이 자동으로 들어가요.
4. **Deployments**에서 최신 배포를 **Redeploy**해요. 이제 사이트 주소를 친구들에게 공유하면 돼요.

저장소를 연결하기 전에는 사이트 위쪽에 안내 문구가 나오고, 수정한 내용은 각자의 브라우저에만 저장돼요.
