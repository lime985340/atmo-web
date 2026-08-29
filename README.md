# atmo-web

Atmo 대기질·날씨 대시보드 Web 서비스입니다. 운영 경로는 `/atmo`이며,
동일 도메인의 `/atmo/api/v1`로 Atmo API를 호출합니다.

## 로컬 빌드

```bash
npm ci
Copy-Item .env.example .env
npm run build
```

`VITE_API_BASE_URL`은 Vite 빌드 시 번들에 포함되므로 Kubernetes Secret이
아닙니다. 이 저장소의 `.gitlab-ci.yml`에 정의한 빌드 기본값만 사용하며,
프로젝트 변수로 같은 키를 중복 정의하지 않습니다.

```text
VITE_API_BASE_URL=/atmo/api/v1
```

Kakao 키가 필요한 경우에만 프로젝트 Protected/Masked 변수
`VITE_KAKAO_APP_KEY`를 설정합니다.

## 운영 경로

```text
/atmo                    → atmo-web
/atmo/api/v1/...         → atmo-api
```

Traefik이 `/atmo` prefix를 제거한 뒤 Web/API 서비스로 전달합니다. API의
Spring Controller 내부 경로는 `/api/v1`을 그대로 유지합니다.
