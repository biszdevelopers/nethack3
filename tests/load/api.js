import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    scenarios: {
        public_reads: {
            executor: "ramping-vus",
            startVUs: 1,
            stages: [
                { duration: "30s", target: 20 },
                { duration: "60s", target: 20 },
                { duration: "20s", target: 0 },
            ],
            exec: "publicReads",
        },
        health_checks: {
            executor: "constant-vus",
            vus: 2,
            duration: "110s",
            exec: "health",
        },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
        "http_req_duration{scenario:public_reads}": ["p(95)<200", "p(99)<500"],
        "http_req_duration{scenario:health_checks}": ["p(95)<50"],
    },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3002";

export function publicReads() {
    const competitions = http.get(`${BASE_URL}/api/v1/public/competitions`);
    check(competitions, {
        "competitions status is 200": (response) => response.status === 200,
    });
    const projects = http.get(`${BASE_URL}/api/v1/public/projects`);
    check(projects, {
        "projects status is 200": (response) => response.status === 200,
    });
    sleep(0.5);
}

export function health() {
    const response = http.get(`${BASE_URL}/health/ready`);
    check(response, {
        "health is ready": (result) => result.status === 200,
    });
    sleep(1);
}
