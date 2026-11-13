"""Build the editable INFRA RUSH AWS architecture diagram.

The only external input is the official AWS Architecture Icons archive.
"""

from __future__ import annotations

import base64
import html
import hashlib
import os
from pathlib import Path
import urllib.request
import zipfile
from xml.etree import ElementTree as ET


HERE = Path(__file__).parent
ICON_ZIP = Path(os.environ.get("AWS_ICONS_ZIP", "/tmp/infra-aws-icons.zip"))
ICON_URL = ("https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/"
            "architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip")
ICON_SHA256 = "d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526"
OUT = HERE / "AWS_ARCHITECTURE.drawio"

root = ET.Element("mxfile", host="app.diagrams.net", modified="2026-09-28T00:00:00.000Z", agent="INFRA RUSH", version="26.0.0", type="device")
diagram = ET.SubElement(root, "diagram", id="infra-rush-aws", name="AWS本番・MLOps")
model = ET.SubElement(diagram, "mxGraphModel", dx="3000", dy="2000", grid="1", gridSize="10", guides="1", tooltips="1", connect="1", arrows="1", fold="1", page="1", pageScale="1", pageWidth="3100", pageHeight="2050", math="0", shadow="0")
cells = ET.SubElement(model, "root")
ET.SubElement(cells, "mxCell", id="0")
ET.SubElement(cells, "mxCell", id="1", parent="0")


def box(id: str, label: str, x: int, y: int, w: int, h: int, *, fill="#ffffff", stroke="#cbd5e1", font=25, bold=False, rounded=12, align="center", dashed=False, sw=2, color="#142133", pad_left=8, v_align="middle", pad_bottom=8) -> None:
    style = f"rounded=1;arcSize={rounded};whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth={sw};fontColor={color};fontSize={font};fontFamily=Arial;align={align};verticalAlign={v_align};spacing=8;spacingLeft={pad_left};spacingBottom={pad_bottom};"
    if bold: style += "fontStyle=1;"
    if dashed: style += "dashed=1;dashPattern=5 4;"
    c = ET.SubElement(cells, "mxCell", id=id, value=html.escape(label), style=style, vertex="1", parent="1")
    ET.SubElement(c, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h), attrib={"as": "geometry"})


def text(id: str, label: str, x: int, y: int, w: int, h: int, *, font=26, color="#142133", bold=False, align="left") -> None:
    style=f"text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;fontSize={font};fontColor={color};fontFamily=Arial;spacing=0;"
    if bold: style += "fontStyle=1;"
    c=ET.SubElement(cells,"mxCell",id=id,value=html.escape(label),style=style,vertex="1",parent="1")
    ET.SubElement(c,"mxGeometry",x=str(x),y=str(y),width=str(w),height=str(h),attrib={"as":"geometry"})


def arrow(id: str, source: str, target: str, label="", *, color="#475569", dashed=False, exit_x=None, exit_y=None, entry_x=None, entry_y=None, label_bg="#050a12") -> None:
    style=f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor={color};strokeWidth=3;endArrow=block;endFill=1;fontSize=18;fontColor={color};labelBackgroundColor={label_bg};"
    if dashed: style += "dashed=1;dashPattern=6 4;"
    if exit_x is not None: style += f"exitX={exit_x};exitY={exit_y};exitDx=0;exitDy=0;"
    if entry_x is not None: style += f"entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;"
    c=ET.SubElement(cells,"mxCell",id=id,value=html.escape(label),style=style,edge="1",parent="1",source=source,target=target)
    ET.SubElement(c,"mxGeometry",relative="1",attrib={"as":"geometry"})


def icon(name: str, id: str, x: int, y: int, size=58):
    found=[p for p in z.namelist() if p.endswith(f"/64/Arch_{name}_64@5x.png")]
    if len(found)!=1: raise RuntimeError(f"Icon missing: {name}: {found}")
    b64=base64.b64encode(z.read(found[0])).decode()
    # mxGraph style values cannot contain a raw semicolon. %3B is decoded by draw.io.
    style=f"shape=image;html=1;imageAspect=0;aspect=fixed;image=data:image/png%3Bbase64,{b64};"
    c=ET.SubElement(cells,"mxCell",id=id,value="",style=style,vertex="1",parent="1")
    ET.SubElement(c,"mxGeometry",x=str(x),y=str(y),width=str(size),height=str(size),attrib={"as":"geometry"})


def service(name: str, id: str, label: str, x: int, y: int, w: int, h: int, *, size=72, color="#cbd5e1", font=18) -> None:
    box(id,label,x,y,w,h,fill="none",stroke="none",font=font,bold=True,color=color,v_align="bottom",pad_bottom=0)
    icon(name,id+"i",x+(w-size)//2,y+4,size)


if not ICON_ZIP.exists():
    urllib.request.urlretrieve(ICON_URL, ICON_ZIP)
if hashlib.sha256(ICON_ZIP.read_bytes()).hexdigest() != ICON_SHA256:
    raise SystemExit(f"Official AWS icon ZIP checksum mismatch: {ICON_ZIP}")

with zipfile.ZipFile(ICON_ZIP) as z:
    box("bg","",0,0,3100,2050,fill="#050a12",stroke="#050a12",rounded=0,sw=0)
    text("title","INFRA RUSH｜AWS 本番構成と CPU バランス調整",80,45,2880,75,font=44,bold=True,color="#f8fafc")
    text("subtitle","設計案（未デプロイ）  •  東京リージョン ap-northeast-1  •  2 AZ  •  2026-09-28",85,125,2800,44,font=23,color="#94a3b8")

    # Top-level lanes and public edge.
    box("edge_lane","",70,205,740,640,fill="#080f1b",stroke="#06b6d4",font=28,bold=True,dashed=True)
    text("edge_header","1  Global Edge / 利用者・配信",105,225,650,46,font=28,bold=True,color="#22d3ee")
    box("aws_lane","",850,205,2160,1130,fill="#080f1b",stroke="#06b6d4",font=30,bold=True,dashed=True)
    text("aws_header","2  AWS Cloud / 東京リージョン",905,225,1950,50,font=30,bold=True,color="#22d3ee")
    box("user","ブラウザ / PWA\n2人対戦・CPU戦",105,295,220,118,fill="none",stroke="none",font=22,bold=True,color="#e2e8f0")
    service("Amazon-Route-53","r53","Route 53\nDNS",385,295,165,125,size=68)
    service("Amazon-CloudFront","cf","CloudFront\n静的配信",590,295,185,125,size=68)
    service("AWS-WAF","waf","AWS WAF\nHTTP / WS 接続制限",385,505,190,125,size=68)
    service("Elastic-Load-Balancing","alb","ALB / TLS 443\nWSS・匿名 POST",595,505,190,125,size=68)
    box("acm","ACM: CloudFront は us-east-1、ALB は東京\nWebSocket 接続後の制限はアプリ内で実施",105,690,675,105,fill="#111827",stroke="#334155",font=21,color="#cbd5e1")
    arrow("a_user_dns","user","r53",color="#38bdf8",exit_x=1,exit_y=.5,entry_x=0,entry_y=.5)
    arrow("a_dns_cf","r53","cf",color="#a78bfa",exit_x=1,exit_y=.35,entry_x=0,entry_y=.35)
    arrow("a_dns_waf","r53","waf","api.example.com",color="#a78bfa",dashed=True,exit_x=.5,exit_y=1,entry_x=.5,entry_y=0)
    arrow("a_waf_alb","waf","alb",color="#fb7185",exit_x=1,exit_y=.5,entry_x=0,entry_y=.5)

    # Region-managed services above VPC.
    service("Amazon-Simple-Storage-Service","static","S3 非公開静的サイト\nOAC / versioning",910,295,270,125,size=68)
    service("Amazon-DynamoDB","dynamo","DynamoDB\n部屋索引 / journal / snapshot\n匿名 matches・feedback",1230,295,360,125,size=68,font=17)
    service("Amazon-EventBridge","event","EventBridge Scheduler\n日次の匿名データ出力",1640,295,320,125,size=68)
    service("Amazon-Simple-Storage-Service","data_s3","S3 非公開データ湖\n集計・監査 / lifecycle",2010,295,310,125,size=68)
    service("Amazon-CloudWatch","ops","CloudWatch / Alarms\n接続・tick・失敗・費用",2370,295,280,125,size=68)
    service("AWS-Secrets-Manager","ecr","ECR / Secrets Manager\n署名鍵・認証情報",2690,295,265,125,size=68)
    arrow("a_cf_s3","cf","static","OAC",color="#84cc16",exit_x=1,exit_y=.5,entry_x=0,entry_y=.5)
    arrow("a_event_s3","event","data_s3","日次バッチ",color="#ec4899",exit_x=1,exit_y=.5,entry_x=0,entry_y=.5)

    # VPC, AZ and subnet containment. The service cards sit inside app/data subnets.
    box("vpc","",910,485,2040,785,fill="#0d1120",stroke="#8b5cf6",font=26,bold=True)
    text("vpc_header","VPC 10.42.0.0/16  |  IGW → 公開 ALB  |  NAT なし  |  private endpoint 経由",960,505,1900,45,font=25,bold=True,color="#c4b5fd")
    box("az_a","",945,575,950,600,fill="#0d1626",stroke="#38bdf8",font=27,bold=True,dashed=True)
    box("az_b","",1945,575,950,600,fill="#0d1626",stroke="#38bdf8",font=27,bold=True,dashed=True)
    text("az_a_header","Availability Zone A",980,588,800,35,font=25,bold=True,color="#67e8f9")
    text("az_b_header","Availability Zone B",1980,588,800,35,font=25,bold=True,color="#67e8f9")
    for suffix,x,public,app,data in [("a",970,"10.42.0.0/24","10.42.10.0/24","10.42.20.0/24"),("b",1970,"10.42.1.0/24","10.42.11.0/24","10.42.21.0/24")]:
        box(f"public_{suffix}",f"Public subnet {public}  •  ALB node",x,635,900,92,fill="#eff5e9",stroke="#86b76b",font=22,bold=True,color="#166534")
        box(f"app_{suffix}","",x,755,900,248,fill="#e8f5fa",stroke="#38bdf8",font=22,bold=True)
        text(f"app_header_{suffix}",f"Private app subnet {app}  •  ECS Fargate",x+35,770,825,42,font=21,bold=True,color="#0369a1")
        box(f"data_{suffix}","",x,1030,900,100,fill="#e8f5fa",stroke="#38bdf8",font=22,bold=True)
        box(f"gw_{suffix}","WS Gateway\n接続 / 再接続 / 匿名 API",x+35,835,380,110,fill="none",stroke="none",font=21,bold=True,v_align="bottom",pad_bottom=4)
        icon("Amazon-Elastic-Container-Service",f"gwi_{suffix}",x+199,828,50)
        box(f"worker_{suffix}","Game Worker\n20 Hz / 部屋所有 / ACK",x+475,835,380,110,fill="none",stroke="none",font=21,bold=True,v_align="bottom",pad_bottom=4)
        icon("Amazon-Elastic-Container-Service",f"workeri_{suffix}",x+639,828,50)
        icon("Amazon-ElastiCache",f"valkeyi_{suffix}",x+90,1050,52)
        text(f"valkeyt_{suffix}",f"Private data subnet {data}  •  ElastiCache Serverless for Valkey\n待機列 / presence / pub-sub",x+160,1045,680,75,font=19,bold=True)
        arrow(f"gw_worker_{suffix}",f"gw_{suffix}",f"worker_{suffix}","内部 RPC",color="#0f766e",exit_x=1,exit_y=.5,entry_x=0,entry_y=.5,label_bg="#e8f5fa")
    arrow("alb_pub","alb","public_a","443",color="#a78bfa",exit_x=1,exit_y=.7,entry_x=0,entry_y=.5)
    # The ALB is multi-AZ; drawing a second cross-zone edge would run through the A subnet label.
    box("endpoints","S3・DynamoDB: Gateway endpoint  |  ECR API/DKR・Logs・Secrets: Interface endpoint を両 AZ\nGateway min 2 / max 12、Worker min 2 / max 20。接続数・部屋数・tick p95 でスケール",950,1185,1940,66,fill="#11263a",stroke="#0e7490",font=19,color="#dbeafe")
    box("routing","SG: ALB→Gateway 8080、Gateway→Worker RPC、Gateway/Worker→Valkey 6379 のみ\n部屋 owner は DynamoDB lease + epoch。1 秒 snapshot と指示 journal を復旧に使用",925,1285,2060,90,fill="#111827",stroke="#475569",font=21,color="#cbd5e1")

    # Dedicated MLOps swimlane with generous spacing.
    box("mlops_lane","",70,1420,2940,550,fill="#080f1b",stroke="#f97316",font=29,bold=True,dashed=True)
    text("mlops_header","3  CPU バランス調整 / MLOps  ─  現行のルールベース調整器を AWS データ経路へ移行",115,1450,2780,50,font=28,bold=True,color="#fb923c")
    steps=[
        ("m1","① データ収集","CPU 対戦結果・任意の感想\nUUID で重複排除 / TTL",115),
        ("m2","② 集計・保管","DynamoDB → 日次バッチ\n非公開 S3 / 個人情報除外",530),
        ("m3","③ 品質ゲート","難易度ごと 80 試合 + 15 回答\n同一設定版 / 3 日 cooldown",945),
        ("m4","④ 候補生成","GitHub Actions tuner\n決定間隔を許容範囲内で調整",1360),
        ("m5","⑤ オフライン評価","固定 seed・左右入替の対戦\n勝率/時間/異常値を比較",1775),
        ("m6","⑥ 承認・反映","テスト/ビルド/履歴記録\ncpu.json を版管理・配信",2190),
        ("m7","⑦ 監視・復旧","CloudWatch + 変更後の指標\n異常時 freeze / 旧版へ戻す",2605),
    ]
    for sid,title,body,x in steps:
        box(sid,title+"\n"+body,x,1520,365,195,fill="#111827",stroke="#fb923c",font=21,bold=True,color="#f8fafc")
    for n in range(1,7):
        arrow(f"ml{n}",f"m{n}",f"m{n+1}",exit_x=1,exit_y=.5,entry_x=0,entry_y=.5,color="#ea580c")
    box("mlops_note","認証: GitHub Actions OIDC → 読取専用 S3 ロール。候補の公開は承認付きワークフローで行う。新しい対戦から再計測し、次の調整へ。\n調整バッチ停止時も対戦サービスは継続。現行は学習済みモデルや SageMaker を使わないため、不要な常時推論基盤は置かない。",115,1775,2840,145,fill="#1f2937",stroke="#9a3412",font=21,color="#e2e8f0")

OUT.write_bytes(ET.tostring(root,encoding="utf-8",xml_declaration=True))
print(OUT)
