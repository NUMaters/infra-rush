#!/usr/bin/env python3
"""Render the INFRA RUSH AWS design as a self-contained SVG.

The AWS-approved 2026-07-31 architecture icon package is fetched once, checked
by SHA-256, and the selected official PNG icons are embedded in the SVG. This
script does not create AWS resources. To regenerate the PNG, open the SVG in a
browser at its native 2400x1600 viewport and capture the full SVG element.
"""

from __future__ import annotations

import base64
import hashlib
import html
import urllib.request
import zipfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
ICON_URL = (
    "https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/"
    "architecture-icon-release/"
    "Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip"
)
ICON_SHA256 = "d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526"
ICON_ZIP = Path("/tmp/infra-aws-icons.zip")
W, H = 2400, 1600

SERVICES = {
    "route53": "Arch_Amazon-Route-53_64@5x.png",
    "cloudfront": "Arch_Amazon-CloudFront_64@5x.png",
    "s3": "Arch_Amazon-Simple-Storage-Service_64@5x.png",
    "waf": "Arch_AWS-WAF_64@5x.png",
    "alb": "Arch_Elastic-Load-Balancing_64@5x.png",
    "ecs": "Arch_Amazon-Elastic-Container-Service_64@5x.png",
    "fargate": "Arch_AWS-Fargate_64@5x.png",
    "dynamodb": "Arch_Amazon-DynamoDB_64@5x.png",
    "valkey": "Arch_Amazon-ElastiCache_64@5x.png",
    "ecr": "Arch_Amazon-Elastic-Container-Registry_64@5x.png",
    "secrets": "Arch_AWS-Secrets-Manager_64@5x.png",
    "cloudwatch": "Arch_Amazon-CloudWatch_64@5x.png",
    "eventbridge": "Arch_Amazon-EventBridge_64@5x.png",
    "acm": "Arch_AWS-Certificate-Manager_64@5x.png",
}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def load_icons() -> dict[str, str]:
    if not ICON_ZIP.exists() or hashlib.sha256(ICON_ZIP.read_bytes()).hexdigest() != ICON_SHA256:
        urllib.request.urlretrieve(ICON_URL, ICON_ZIP)
    data = ICON_ZIP.read_bytes()
    if hashlib.sha256(data).hexdigest() != ICON_SHA256:
        raise RuntimeError("AWS icon package hash differs from the documented 2026-07-31 package")
    with zipfile.ZipFile(ICON_ZIP) as archive:
        names = archive.namelist()
        result = {}
        for key, filename in SERVICES.items():
            matches = [
                name for name in names
                if name.endswith("/" + filename) and not name.startswith("__MACOSX/")
            ]
            if len(matches) != 1:
                raise RuntimeError(f"Expected one official AWS icon for {filename}: {matches}")
            result[key] = "data:image/png;base64," + base64.b64encode(archive.read(matches[0])).decode()
        return result


icons = load_icons()
base: list[str] = []
links: list[str] = []
cards: list[str] = []
labels: list[str] = []


def rect(x: int, y: int, w: int, h: int, *, fill="#fff", stroke="#d8dfe7", width=2,
         radius=16, target=cards, dash="") -> None:
    d = f' stroke-dasharray="{dash}"' if dash else ""
    target.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{width}"{d}/>'
    )


def txt(x: int, y: int, s: str, *, size=22, weight=500, color="#162334", anchor="start",
        target=labels, spacing="") -> None:
    letter = f' letter-spacing="{spacing}"' if spacing else ""
    target.append(
        f'<text x="{x}" y="{y}" fill="{color}" font-family="Arial, Helvetica, sans-serif" '
        f'font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{letter}>{esc(s)}</text>'
    )


def image(x: int, y: int, key: str, size=60, target=cards) -> None:
    target.append(f'<image x="{x}" y="{y}" width="{size}" height="{size}" href="{icons[key]}"/>')


def line(points: list[tuple[int, int]], *, color="#53677d", width=4, dash="", arrow=True) -> None:
    ps = " ".join(f"{x},{y}" for x, y in points)
    d = f' stroke-dasharray="{dash}"' if dash else ""
    marker = ' marker-end="url(#arrow)"' if arrow else ""
    links.append(
        f'<polyline points="{ps}" fill="none" stroke="{color}" stroke-width="{width}" '
        f'stroke-linecap="round" stroke-linejoin="round"{d}{marker}/>'
    )


def service_card(x: int, y: int, w: int, h: int, key: str, title: str, detail: str,
                 *, fill="#fff", small="", icon_size=60) -> None:
    rect(x, y, w, h, fill=fill)
    image(x + 22, y + (h - icon_size) // 2, key, icon_size)
    txt(x + 96, y + 39, title, size=24, weight=700)
    txt(x + 96, y + 70, detail, size=17, color="#526176")
    if small:
        txt(x + 96, y + 94, small, size=15, color="#627487")


# Background and header.
rect(0, 0, W, H, fill="#f7f9fc", stroke="#f7f9fc", width=0, radius=0, target=base)
rect(0, 0, W, 172, fill="#172b42", stroke="#172b42", width=0, radius=0, target=base)
txt(72, 78, "INFRA RUSH  |  AWS REFERENCE ARCHITECTURE", size=43, weight=700,
    color="#fff", target=base, spacing="1.1")
txt(74, 124, "TARGET STATE  ·  ap-northeast-1 (Tokyo)  ·  2 AZ  ·  DESIGN / NOT DEPLOYED",
    size=22, color="#cfd9e4", target=base)
rect(2015, 44, 315, 76, fill="#273c54", stroke="#60738a", width=1, radius=14, target=base)
txt(2172, 76, "20 Hz authoritative", size=20, weight=700, color="#fff", anchor="middle", target=base)
txt(2172, 103, "2-player, 6-minute match", size=17, color="#d6e2ed", anchor="middle", target=base)

# Internet and edge.
txt(70, 222, "PLAYER / EDGE", size=20, weight=700, color="#53677d", spacing="1.6")
rect(70, 244, 242, 118, fill="#fff", stroke="#b7c8d9")
txt(191, 286, "Browser", size=28, weight=700, anchor="middle")
txt(191, 320, "WebGL + WSS", size=18, color="#526176", anchor="middle")
service_card(352, 244, 262, 118, "route53", "Route 53", "game / api DNS")
service_card(655, 244, 293, 118, "cloudfront", "CloudFront", "HTTPS static / CDN")
service_card(990, 244, 279, 118, "s3", "S3 + OAC", "private web + GLB")
service_card(1362, 244, 279, 118, "waf", "AWS WAF", "API edge rate rules")
service_card(1683, 244, 289, 118, "acm", "ACM TLS", "us-east-1 / Tokyo")
rect(2014, 244, 316, 118, fill="#fff", stroke="#b7c8d9")
txt(2172, 284, "Two paths", size=23, weight=700, anchor="middle")
txt(2172, 312, "Static: CloudFront", size=17, color="#526176", anchor="middle")
txt(2172, 338, "Realtime: ALB", size=17, color="#526176", anchor="middle")
line([(312, 303), (352, 303)], dash="7 6", color="#6c7d90")
line([(614, 303), (655, 303)])
line([(948, 303), (990, 303)])
line([(312, 339), (330, 339), (330, 387), (1494, 387), (1494, 362)], color="#df8530")
txt(904, 380, "WSS / HTTPS API via Route 53", size=17, color="#a66120", anchor="middle")
line([(1494, 362), (1494, 437), (770, 437), (770, 503)], color="#df8530")

# AWS region and VPC.
rect(65, 417, 1534, 1021, fill="#fff", stroke="#8a6fba", width=3, radius=22, target=base)
rect(82, 434, 1500, 986, fill="#f8f6fc", stroke="#cabbe0", width=2, radius=18, target=base)
txt(115, 466, "VPC  10.42.0.0/16", size=30, weight=700, color="#5f4486", target=base)
txt(519, 466, "AWS Region: ap-northeast-1", size=20, color="#5f4486", target=base)
txt(1430, 466, "No NAT by default", size=17, color="#5f4486", anchor="end", target=base)

# Public subnets.
rect(105, 487, 710, 156, fill="#f2faf5", stroke="#79b88a", radius=15, target=base)
rect(847, 487, 710, 156, fill="#f2faf5", stroke="#79b88a", radius=15, target=base)
txt(131, 519, "AZ A  /  PUBLIC", size=20, weight=700, color="#287242", target=base)
txt(131, 545, "10.42.0.0/24  ·  0.0.0.0/0 → IGW", size=17, color="#287242", target=base)
txt(875, 519, "AZ B  /  PUBLIC", size=20, weight=700, color="#287242", target=base)
txt(875, 545, "10.42.1.0/24  ·  0.0.0.0/0 → IGW", size=17, color="#287242", target=base)
rect(586, 538, 500, 82, fill="#fff", stroke="#78a48d", width=2, radius=14)
image(606, 546, "alb", 64)
txt(686, 572, "Application Load Balancer", size=23, weight=700)
txt(686, 599, "443 TLS  ·  /ws + /matches + /feedback", size=17, color="#526176")
txt(257, 605, "ALB node A", size=18, weight=600, color="#3a7851")
txt(1368, 605, "ALB node B", size=18, weight=600, color="#3a7851", anchor="end")

# App subnets.
rect(105, 669, 710, 375, fill="#f1f7ff", stroke="#79a5d5", radius=16, target=base)
rect(847, 669, 710, 375, fill="#f1f7ff", stroke="#79a5d5", radius=16, target=base)
txt(131, 702, "AZ A  /  PRIVATE APP", size=20, weight=700, color="#245d96", target=base)
txt(131, 728, "10.42.10.0/24  ·  no public IP", size=17, color="#245d96", target=base)
txt(875, 702, "AZ B  /  PRIVATE APP", size=20, weight=700, color="#245d96", target=base)
txt(875, 728, "10.42.11.0/24  ·  no public IP", size=17, color="#245d96", target=base)
service_card(129, 756, 660, 108, "fargate", "WS Gateway A", "ECS Fargate · min 1 / AZ", fill="#fff", small="sessions, queue, validation, fan-out")
service_card(872, 756, 660, 108, "fargate", "WS Gateway B", "ECS Fargate · min 1 / AZ", fill="#fff", small="sessions, queue, validation, fan-out")
service_card(129, 902, 660, 108, "ecs", "Game Worker A", "ECS Fargate · min 1 / AZ", fill="#fff", small="single owner / room, 20 Hz tick")
service_card(872, 902, 660, 108, "ecs", "Game Worker B", "ECS Fargate · min 1 / AZ", fill="#fff", small="single owner / room, 20 Hz tick")
line([(690, 620), (690, 743), (459, 743), (459, 756)], color="#4279ae")
line([(982, 620), (982, 743), (1202, 743), (1202, 756)], color="#4279ae")
line([(459, 864), (459, 902)], color="#4279ae")
line([(1202, 864), (1202, 902)], color="#4279ae")
txt(830, 887, "owner RPC over private IP", size=17, color="#365c87", anchor="middle")

# Data subnets and endpoints.
rect(105, 1075, 710, 165, fill="#fbf6ef", stroke="#d4ad74", radius=16, target=base)
rect(847, 1075, 710, 165, fill="#fbf6ef", stroke="#d4ad74", radius=16, target=base)
txt(131, 1108, "AZ A  /  PRIVATE DATA", size=20, weight=700, color="#97662e", target=base)
txt(131, 1135, "10.42.20.0/24", size=17, color="#97662e", target=base)
txt(875, 1108, "AZ B  /  PRIVATE DATA", size=20, weight=700, color="#97662e", target=base)
txt(875, 1135, "10.42.21.0/24", size=17, color="#97662e", target=base)
service_card(467, 1125, 730, 94, "valkey", "ElastiCache Serverless for Valkey", "Multi-AZ queue · presence · pub/sub", fill="#fff")
line([(459, 1010), (459, 1061), (708, 1061), (708, 1125)], color="#b07b39")
line([(1202, 1010), (1202, 1061), (956, 1061), (956, 1125)], color="#b07b39")
rect(105, 1271, 1452, 133, fill="#fff", stroke="#a5adc5", radius=14)
txt(135, 1306, "PRIVATE AWS ACCESS  ·  route tables / VPC endpoints", size=20, weight=700, color="#4f5e79")
txt(135, 1340, "Gateway endpoints: S3 + DynamoDB (app route tables; no hourly endpoint fee)", size=18, color="#4f5e79")
txt(135, 1372, "Interface endpoints in both AZs: ECR API / ECR DKR / CloudWatch Logs / Secrets Manager", size=18, color="#4f5e79")

# Managed services, outside the VPC rectangle.
rect(1641, 417, 694, 1021, fill="#fff", stroke="#b6c6d5", width=2, radius=22, target=base)
txt(1670, 463, "REGIONAL MANAGED SERVICES", size=24, weight=700, color="#40566c", target=base)
service_card(1669, 491, 638, 142, "dynamodb", "DynamoDB  ·  on demand", "room directory / owner lease / code", small="snapshots / command journal / anonymous records")
service_card(1669, 662, 638, 126, "s3", "Private S3 data bucket", "daily anonymous exports / backups", small="versioning + lifecycle policy")
service_card(1669, 818, 305, 125, "ecr", "Amazon ECR", "signed image digests", icon_size=54)
service_card(2001, 818, 306, 125, "secrets", "Secrets Manager", "tokens / signing keys", icon_size=54)
service_card(1669, 972, 305, 125, "cloudwatch", "CloudWatch", "logs / SLO alarms", icon_size=54)
service_card(2001, 972, 306, 125, "eventbridge", "EventBridge", "daily export job", icon_size=54)
rect(1669, 1127, 638, 276, fill="#f5f8fb", stroke="#d3dfe9", radius=14)
txt(1695, 1167, "CONTROL + RESILIENCE", size=22, weight=700, color="#40566c")
txt(1695, 1206, "Room owner lease with fencing epoch", size=18, color="#40566c")
txt(1695, 1237, "Journal before ACK; snapshot ~1 s", size=18, color="#40566c")
txt(1695, 1268, "Reconnect to a new Gateway after failure", size=18, color="#40566c")
txt(1695, 1299, "Scale: active WS + CPU / active rooms + tick p95", size=18, color="#40566c")
txt(1695, 1343, "Current Go in-memory hub requires refactor", size=18, weight=700, color="#9b4f35")
txt(1695, 1372, "before this multi-task design can run.", size=18, color="#9b4f35")

# Cross-boundary operational arrows; keep them away from main card text.
line([(1532, 954), (1608, 954), (1608, 562), (1669, 562)], color="#865bad", dash="8 7")
txt(1597, 770, "lease + journal", size=16, color="#75509e", anchor="end")
line([(1532, 826), (1608, 826), (1608, 724), (1669, 724)], color="#865bad", dash="8 7")
txt(1597, 845, "export", size=16, color="#75509e", anchor="end")

# Footer: read order, security group key, provenance.
rect(65, 1461, 2270, 106, fill="#172b42", stroke="#172b42", width=0, radius=15, target=base)
txt(91, 1500, "FLOW", size=18, weight=700, color="#ffb45e", target=base)
txt(168, 1500, "Browser → CloudFront/S3 (static)  |  Browser → WAF/ALB → Gateway → room owner Worker → Valkey fan-out", size=19, color="#fff", target=base)
txt(91, 1537, "SG", size=18, weight=700, color="#ffb45e", target=base)
txt(168, 1537, "ALB:443 public   Gateway:8080 from ALB   Worker:RPC from Gateway   Valkey:6379 from app   Endpoint:443 from app", size=18, color="#dce6ef", target=base)
txt(2330, 1591, "Official AWS Architecture Icons · 2026-07-31 · Diagram: project-specific design", size=14,
    color="#67788a", anchor="end", target=base)

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
    f'width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" '
    f'aria-label="INFRA RUSH target AWS architecture">'
    '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" '
    'orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#53677d"/></marker></defs>'
    + "".join(base + links + cards + labels)
    + "</svg>"
)
output = HERE / "AWS_ARCHITECTURE.svg"
output.write_text(svg, encoding="utf-8")
print(output)
