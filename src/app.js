import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import * as THREE from "three";
import * as d3 from "d3";
import { gsap } from "gsap";
import * as XLSX from "xlsx";
import * as Icons from "lucide-react";

const html = htm.bind(React.createElement);
const DATA = window.COMPETITION_DATA;

const iconNames = {
  overview: Icons.LayoutDashboard,
  rules: Icons.ScrollText,
  charts: Icons.BarChart3,
  rewards: Icons.Trophy,
  duties: Icons.Workflow,
  traffic: Icons.Funnel,
  guide: Icons.HelpCircle,
  source: Icons.FileText,
};

function fmt(n) {
  if (typeof n !== "number") return n;
  return n.toLocaleString("zh-CN");
}

function pct(n) {
  return `${Math.round(n * 1000) / 10}%`;
}

function numericValue(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (text.endsWith("%")) return Number(text.replace("%", "")) / 100;
  return Number(text.replace(/,/g, "")) || 0;
}

function calcKosScore(row) {
  const completion = Math.min(row.actual / Math.max(row.target, 1), 2);
  const qualifiedRate = row.qualifiedWorks / Math.max(row.totalWorks, 1);
  const abnormalDeduct = row.abnormal > 0.1 ? -2 : 0;
  return completion + qualifiedRate * 2 + row.top1000 * 0.02 + abnormalDeduct;
}

function calcWorkScore(work) {
  return (
    Number(work.dyPlay || 0) +
    Number(work.ksPlay || 0) +
    (Number(work.dyLike || 0) + Number(work.ksLike || 0) + Number(work.xhsLike || 0)) * 10 +
    (Number(work.dyFav || 0) + Number(work.xhsFav || 0)) * 10
  );
}

function getIcon(name, fallback = Icons.CircleDot) {
  return Icons[name] || fallback;
}

function trackDrawerBody(track) {
  return [
    `赛道：${track.name}`,
    `评比对象：${track.object}`,
    `统计范围：${track.data}`,
    `评分公式：${track.formula}`,
    `评奖范围：${track.award}`,
    "KOS完成率：KOS实际完成数 / KOS数量指标，得分上限为2；KOS实际完成数指本赛季终端参与对应品牌活动并有效发布1个及以上作品。",
    "作品质量：终端KOS看达标作品率，达标标准为同一作品抖音播放量+快手播放量大于500；内部KOC看优质作品数，优质标准为播放量大于1000且点赞量大于50。",
    "入围计分：KOS作品入选TOP1000一次得0.02分；内部KOC作品入选TOP100一次得0.1分；同分并列顺延，实际入选数量可能超过1000或100。",
    "异常处理：KOS赛道异常作品率超过10%直接扣2分；8%为过程提示阈值；内部KOC异常作品直接剔除，不纳入最终统计。",
  ].join("\n");
}

function ParticleBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 58;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const count = 820;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorA = new THREE.Color("#7B1113");
    const colorB = new THREE.Color("#001F3F");
    const colorC = new THREE.Color("#c7a54a");
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 130;
      positions[i3 + 1] = (Math.random() - 0.5) * 82;
      positions[i3 + 2] = (Math.random() - 0.5) * 66;
      const mix = i % 3 === 0 ? colorA : i % 3 === 1 ? colorB : colorC;
      colors[i3] = mix.r;
      colors[i3 + 1] = mix.g;
      colors[i3 + 2] = mix.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = 0;
    const animate = () => {
      const t = performance.now() * 0.00035;
      points.rotation.y = t;
      points.rotation.x = Math.sin(t * 0.7) * 0.12;
      const arr = geometry.attributes.position.array;
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        arr[i3 + 1] += Math.sin(t * 6 + i * 0.03) * 0.004;
        arr[i3] += Math.cos(t * 4 + i * 0.04) * 0.003;
      }
      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, []);

  return html`<div className="background-canvas" ref=${mountRef}></div>`;
}

function useSectionAnimation() {
  useEffect(() => {
    const items = gsap.utils.toArray(".reveal");
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            gsap.to(entry.target, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach(item => {
      gsap.set(item, { y: 28, opacity: 0 });
      observer.observe(item);
    });
    return () => observer.disconnect();
  }, []);
}

function Nav({ active }) {
  const links = [
    ["hero", "总览"],
    ["rules", "规则"],
    ["viz", "数据"],
    ["rewards", "奖励"],
    ["duties", "分工"],
    ["traffic", "流量"],
    ["jump", "分类"],
    ["guide", "指南"],
    ["source", "核对"],
  ];
  return html`
    <nav className="top-nav">
      <a href="#hero" className="brand-mark" aria-label="回到首页">
        <span className="mark-dot"></span>
        <span>3K Q2 Command</span>
      </a>
      <div className="nav-links">
        ${links.map(([id, label]) => html`<a key=${id} className=${active === id ? "active" : ""} href=${`#${id}`}>${label}</a>`)}
      </div>
    </nav>
  `;
}

function MobileDock({ active }) {
  const links = [
    ["hero", "总览", Icons.Home],
    ["rules", "规则", Icons.Route],
    ["viz", "数据", Icons.BarChart3],
    ["rewards", "奖励", Icons.Trophy],
    ["guide", "指南", Icons.HelpCircle],
  ];
  return html`
    <nav className="mobile-dock" aria-label="手机端快捷导航">
      ${links.map(([id, label, Icon]) => html`
        <a key=${id} className=${active === id ? "active" : ""} href=${`#${id}`} aria-label=${label}>
          <${Icon} />
          <span>${label}</span>
        </a>
      `)}
    </nav>
  `;
}

function SectionHead({ eyebrow, title, body, action }) {
  return html`
    <div className="section-head reveal">
      <div>
        <span className="eyebrow">${eyebrow}</span>
        <h2>${title}</h2>
        ${body && html`<p>${body}</p>`}
      </div>
      ${action}
    </div>
  `;
}

function Hero({ totals, setDrawer }) {
  const sourceBody = [
    "基于公司二季度3K运营竞赛规则、附件指标和培训口径构建。",
    "覆盖全国营销大区、品牌运营部、办事处和内部KOC赛道。",
    "页面不以单一大区或单个办事处为默认视角，全国指标、规则公式和附件表均可核对。",
  ].join("\n");
  return html`
    <section id="hero" className="section hero">
      <div className="section-inner hero-grid">
        <div className="reveal">
          <span className="eyebrow"><${Icons.Sparkles} /> 2026 Q2 3K运营劳动竞赛</span>
          <h1>一页看懂规则、流程、评分、奖励与执行抓手</h1>
          <p className="lead">
            基于公司二季度3K运营竞赛规则、附件指标和培训口径构建，覆盖全国营销大区、品牌、办事处和内部KOC赛道。
            页面用于快速理解规则、核对公式、查看全国指标和更新最新数据。
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#rules"><${Icons.Route} /> 进入规则地图</a>
            <a className="btn secondary" href="#viz"><${Icons.Activity} /> 查看全国数据</a>
            <button className="btn secondary" onClick=${() => setDrawer({ title: "页面依据", body: sourceBody })}>
              <${Icons.Database} /> 页面依据
            </button>
          </div>
          <div className="mobile-only mobile-command-card" aria-label="手机专属快速入口">
            <div className="mobile-command-copy">
              <span>手机专属视图</span>
              <strong>先定赛道，再看数据，再核对规则</strong>
              <p>适合会议现场、巡店和移动办公查看；底部任务栏可直接跳到核心模块。</p>
            </div>
            <div className="mobile-command-grid">
              <a href="#rules"><${Icons.Route} />规则下钻</a>
              <a href="#viz"><${Icons.BarChart3} />全国指标</a>
              <a href="data/3k-q2-data-template.xlsx" download><${Icons.Download} />Excel模板</a>
              <a href="#source"><${Icons.Search} />原文核对</a>
            </div>
          </div>
        </div>
        <div className="hero-panel reveal">
          <div className="hero-meter">
            <span className="orbit o1"></span>
            <span className="orbit o2"></span>
            <div className="hero-core">
              <div>
                <span>二季度规则主线</span>
                <strong>4赛道</strong>
                <p>完成率、达标率、TOP入围、异常率联动；内部KOC拆分为集体和个人赛道。</p>
              </div>
              <div className="stat-grid">
                <div className="stat" title="6个品牌运营部、45个办事处、9个职能部门">
                  <b>${totals.units}</b><small>参赛组织单元</small>
                </div>
                <div className="stat" title="附件品牌KOS指标合计">
                  <b>${fmt(totals.kosTarget)}</b><small>KOS指标合计</small>
                </div>
                <div className="stat" title="按奖励名额和奖金估算">
                  <b>${fmt(totals.rewardBudget)}</b><small>规则奖金池</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function RuleFlow({ data, setDrawer }) {
  const steps = [
    {
      title: "活动目的",
      meta: "二季度导向",
      body: [
        data.rules.purpose,
        "规则定位：劳动竞赛是公司3K运营的季度牵引机制，用竞赛方式把销售一线、品牌运营部和职能部门的动作统一到同一套目标、数据和复盘节奏中。",
        "二季度管理重点：数量增长适当放缓，但对内容质量、达标作品、TOP入围和异常治理要求更高，避免只堆数量、不看质量。",
        "页面阅读建议：先确认自己属于哪条赛道，再核对采集周期、有效KOS标准、作品评分公式、异常扣分和奖励范围。",
      ].join("\n"),
      icon: Icons.Target,
    },
    {
      title: "赛道划分",
      meta: "4条赛道",
      body: data.rules.tracks.map(track => `${track.name}：评比对象为${track.object}；数据口径为${track.data}；评奖范围为${track.award}。`).join("\n"),
      icon: Icons.Route,
    },
    {
      title: "采集周期",
      meta: "2026.03.26-06.30",
      body: `${data.rules.time}\n所有二季度发起的活动不得超出该区间；单场活动时长不超过60个自然日；活动结束后相关作品数据不再更新。上传页面数据时，应使用该采集期内截至导出时点的数据。`,
      icon: Icons.CalendarClock,
    },
    {
      title: "指标定义",
      meta: "KOS / TOP / 异常",
      body: data.rules.metricDefinitions.map(item => `${item.name}：${item.standard}`).join("\n"),
      icon: Icons.Gauge,
    },
    {
      title: "评分排名",
      meta: "公式 + 同分规则",
      body: `${data.rules.tracks.map(track => `${track.name}：${track.formula}`).join("\n")}\n同分规则：${data.rules.rankingTieBreak}`,
      icon: Icons.Calculator,
    },
    {
      title: "奖励职责",
      meta: "激励 + 分工",
      body: [
        "奖励范围：品牌运营部第1-4名、办事处第1-30名、内部KOC集体赛道共7名、内部KOC个人赛道前20名参与评奖。",
        "制度激励：获奖人员在年度评优评先时优先推荐；赛道排名靠前单位人员的获奖结果可作为干部提拔、员工晋升参考依据。",
        "职责闭环：品牌运营部负责活动策划和优质作品投流；营销大区负责发动终端KOS和异常整改；品牌管理与市场洞察部负责规则答疑、数据统计、系统运维和复盘；消费者运营部、渠道管理部、工会财务、人资综合经营、审计纪委分别承担系统、转化、奖励、公示与监督职责。",
      ].join("\n"),
      icon: Icons.Handshake,
    },
  ];
  return html`
    <div className="rule-flow reveal">
      ${steps.map((step, index) => {
        const Icon = step.icon || Icons.CircleDot;
        return html`
          <button className="rule-step" key=${step.title} onClick=${() => setDrawer({ title: step.title, body: step.body })}>
            <span className="step-no">${String(index + 1).padStart(2, "0")}</span>
            <span className="card-icon"><${Icon} /></span>
            <strong>${step.title}</strong>
            <small>${step.meta}</small>
          </button>
        `;
      })}
    </div>
  `;
}

function RuleAudit({ data, setDrawer }) {
  const items = [
    ["有效KOS", "采集期内使用“浓友分享+”参与对应品牌任务，并在抖音、快手、小红书发布1条及以上正向作品。"],
    ["品牌范围", "战略品牌、成长品牌、品资中心品牌按培训口径归属；同一KOS在同品牌最多有效计一次。"],
    ["指标来源", "办事处指标见附件2，品牌指标由各办事处分品牌指标汇总，附件1全国合计为3067。"],
    ["TOP入围", "有效作品剔除异常后拉通排名；KOS取前1000，内部KOC取前100，允许同分并列顺延。"],
    ["达标作品", "同一作品抖音播放量+快手播放量大于500，计入KOS达标作品率。"],
    ["优质作品", "内部KOC作品需播放量大于1000且抖音+快手+小红书点赞数大于50。"],
    ["异常阈值", "异常作品率8%为过程提示线；超过10%直接扣2分；内部KOC异常作品直接剔除。"],
    ["同分排序", "分赛道得分相同时，依次比较总点赞量、总收藏量、总播放量、总作品数。"],
    ["分数平移", "分管领导或大区负责人参与内部KOC活动时，得分按规则平移到对应部门或办事处。"],
    ["归属冲突", "实际货权归属与地理维度归属冲突时，以消费者运营部判定为准。"],
  ];
  return html`
    <div className="audit-strip reveal">
      ${items.map(([title, body]) => html`
        <button className="audit-chip" key=${title} onClick=${() => setDrawer({ title, body })}>
          <strong>${title}</strong>
          <span>${body}</span>
        </button>
      `)}
    </div>
  `;
}

function RuleModule({ data, activeTrack, setActiveTrack, setDrawer }) {
  const track = data.rules.tracks.find(t => t.name === activeTrack) || data.rules.tracks[0];
  const [work, setWork] = useState(data.sampleWorks[0]);
  const score = calcWorkScore(work);

  const update = (key, value) => setWork({ ...work, [key]: Number(value) });

  return html`
    <section id="rules" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="竞赛规则"
          title="四条赛道、七类指标、六类异常"
          body="按规则文档顺序重排，先看周期和赛道，再看指标、公式、异常、排名和奖励范围。点击节点可展开完整口径。"
        />
        <${RuleFlow} data=${data} setDrawer=${setDrawer} />
        <div className="tabs reveal">
          ${data.rules.tracks.map(t => html`
            <button key=${t.name} className=${`tab ${activeTrack === t.name ? "active" : ""}`} onClick=${() => setActiveTrack(t.name)}>
              ${t.name}
            </button>
          `)}
        </div>
        <div className="rule-focus reveal">
          <button className="card pad interactive as-card" onClick=${() => setDrawer({ title: track.name, body: trackDrawerBody(track) })}>
            <span className="card-icon"><${Icons.Flag} /></span>
            <h3>${track.name}</h3>
            <p>${track.object}；${track.data}。</p>
            <code className="formula">${track.formula}</code>
            <div className="meta-line"><span>${track.award}</span></div>
          </button>
          <button className="card pad interactive as-card" onClick=${() => setDrawer({ title: "活动对象定义", body: `${data.rules.definitions.terminalKos}\n\n${data.rules.definitions.internalKoc}` })}>
            <span className="card-icon"><${Icons.UsersRound} /></span>
            <h3>终端KOS / 内部KOC</h3>
            <p>${data.rules.definitions.terminalKos}</p>
            <p className="muted">${data.rules.definitions.internalKoc}</p>
          </button>
        </div>
        <div className="metric-board reveal">
          ${data.rules.metricDefinitions.map(item => html`
            <button className="metric-item" key=${item.name} onClick=${() => setDrawer({ title: item.name, body: item.standard })}>
              <strong>${item.name}</strong>
              <span>${item.standard}</span>
            </button>
          `)}
        </div>
        <${RuleAudit} data=${data} setDrawer=${setDrawer} />
        <div className="rules-two-col reveal">
          <article className="card pad">
            <div className="chart-title">
              <h3>单条作品评分试算</h3>
              <span>播放×1 + 点赞×10 + 收藏×10</span>
            </div>
            <div className="calculator">
              <div className="calc-grid">
                ${[
                  ["dyPlay", "抖音播放"],
                  ["ksPlay", "快手播放"],
                  ["dyLike", "抖音点赞"],
                  ["ksLike", "快手点赞"],
                  ["xhsLike", "小红书点赞"],
                  ["dyFav", "抖音收藏"],
                  ["xhsFav", "小红书收藏"],
                ].map(([key, label]) => html`
                  <label className="field" key=${key}>
                    <span>${label}</span>
                    <input type="number" min="0" value=${work[key] || 0} onInput=${e => update(key, e.currentTarget.value)} />
                  </label>
                `)}
              </div>
              <div className="score-box">
                <span>当前作品得分</span>
                <b>${fmt(score)}</b>
                <span>${score >= 10000 ? "具备冲TOP潜力" : score >= 1500 ? "达标后继续优化互动" : "先提高播放和冷启动"}</span>
              </div>
            </div>
          </article>
          <article className="card pad">
            <div className="chart-title">
              <h3>异常作品处理</h3>
              <span>8%提示，10%扣2分</span>
            </div>
            <div className="risk-list">
              ${data.rules.abnormalTypes.map(item => html`
                <button className="risk-item" key=${item.name} onClick=${() => setDrawer({ title: item.name, body: `${item.detail}\n处理：${item.handling}` })}>
                  <h4 className="danger">${item.name}</h4>
                  <p>${item.detail}</p>
                </button>
              `)}
            </div>
          </article>
        </div>
      </div>
    </section>
  `;
}

function BarChart({ rows, mode }) {
  const ref = useRef(null);
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const node = ref.current;
    const width = node.clientWidth || 600;
    const height = node.clientHeight || 300;
    const margin = { top: 36, right: 18, bottom: 58, left: 44 };
    const data = rows.map(row => ({
      name: row.office || row.brand || row.region,
      value: mode === "qualified" ? row.qualifiedWorks / Math.max(row.totalWorks, 1) : row.actual / Math.max(row.target, 1),
    }));
    const x = d3.scaleBand().domain(data.map(d => d.name)).range([margin.left, width - margin.right]).padding(0.26);
    const y = d3.scaleLinear().domain([0, Math.max(2, d3.max(data, d => d.value) || 1)]).nice().range([height - margin.bottom, margin.top]);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickSizeOuter(0)).selectAll("text").attr("transform", "rotate(-32)").style("text-anchor", "end");
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`));
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "barGrad").attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#7B1113");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#001F3F");
    svg.selectAll("rect").data(data).join("rect")
      .attr("x", d => x(d.name))
      .attr("y", height - margin.bottom)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("rx", 4)
      .attr("fill", "url(#barGrad)")
      .append("title").text(d => `${d.name}: ${pct(d.value)}`);
    svg.selectAll("rect")
      .transition().duration(760).ease(d3.easeCubicOut)
      .attr("y", d => y(d.value))
      .attr("height", d => y(0) - y(d.value));
    svg.append("g").selectAll("text").data(data).join("text")
      .attr("x", d => x(d.name) + x.bandwidth() / 2)
      .attr("y", d => Math.max(margin.top - 10, y(d.value) - 8))
      .attr("text-anchor", "middle")
      .attr("font-size", width < 480 ? 10 : 12)
      .attr("font-weight", 850)
      .attr("fill", "#001F3F")
      .text(d => pct(d.value));
  }, [rows, mode]);
  return html`<svg className="chart" ref=${ref}></svg>`;
}

function Heatmap({ rows }) {
  const ref = useRef(null);
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const node = ref.current;
    const width = node.clientWidth || 600;
    const height = node.clientHeight || 300;
    const margin = { top: 18, right: 14, bottom: 48, left: 70 };
    const regions = Array.from(new Set(rows.map(d => d.region))).slice(0, 12);
    const buckets = ["完成", "达标", "TOP", "异常"];
    const cells = regions.flatMap(region => {
      const group = rows.filter(d => d.region === region);
      const avg = key => d3.mean(group, key) || 0;
      return [
        { region, bucket: "完成", value: avg(d => d.actual / d.target) },
        { region, bucket: "达标", value: avg(d => d.qualifiedWorks / d.totalWorks) },
        { region, bucket: "TOP", value: avg(d => d.top1000 / 20) },
        { region, bucket: "异常", value: avg(d => d.abnormal) },
      ];
    });
    const x = d3.scaleBand().domain(buckets).range([margin.left, width - margin.right]).padding(0.08);
    const y = d3.scaleBand().domain(regions).range([margin.top, height - margin.bottom]).padding(0.08);
    const color = d3.scaleSequential(d3.interpolateRgbBasis(["#eef4ff", "#c7a54a", "#7B1113"])).domain([0, 1.2]);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.append("g").selectAll("text").data(buckets).join("text")
      .attr("x", d => x(d) + x.bandwidth() / 2)
      .attr("y", height - 18)
      .attr("text-anchor", "middle")
      .attr("font-weight", 800)
      .text(d => d);
    svg.append("g").selectAll("text").data(regions).join("text")
      .attr("x", margin.left - 10)
      .attr("y", d => y(d) + y.bandwidth() / 2 + 5)
      .attr("text-anchor", "end")
      .attr("font-weight", 800)
      .text(d => d);
    svg.append("g").selectAll("rect").data(cells).join("rect")
      .attr("x", d => x(d.bucket))
      .attr("y", d => y(d.region))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 5)
      .attr("fill", d => color(Math.min(d.value, 1.2)))
      .attr("opacity", 0)
      .append("title").text(d => `${d.region} ${d.bucket}: ${pct(d.value)}`);
    svg.selectAll("rect").transition().duration(600).attr("opacity", 1);
  }, [rows]);
  return html`<svg className="chart" ref=${ref}></svg>`;
}

function NetworkGraph({ abnormalTypes }) {
  const ref = useRef(null);
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const node = ref.current;
    const width = node.clientWidth || 600;
    const height = node.clientHeight || 300;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const labelLines = label => {
      const map = {
        "多人使用同一作品链接": ["多人使用", "同一作品", "链接"],
        "用户使用他人账号": ["使用他人", "账号"],
        "播放数据小于单项": ["播放小于", "单项互动"],
        "异常掉赞行为": ["异常", "掉赞"],
        "作品内容与品牌无关": ["内容与", "品牌无关"],
        "提示阈值8%": ["提示阈值", "8%"],
        "扣分阈值10%": ["扣分阈值", "10%"],
      };
      return map[label] || (label.length > 6 ? [label.slice(0, 4), label.slice(4, 8), label.slice(8, 12)].filter(Boolean) : [label]);
    };
    const nodes = [
      { id: "异常作品", group: 0, r: 34 },
      ...abnormalTypes.map((d, i) => ({ id: d.name, group: i + 1, r: 34, detail: d.detail })),
      { id: "提示阈值8%", group: 8, r: 30 },
      { id: "扣分阈值10%", group: 9, r: 32 },
    ];
    const links = [
      ...abnormalTypes.map(d => ({ source: "异常作品", target: d.name })),
      { source: "异常作品", target: "提示阈值8%" },
      { source: "提示阈值8%", target: "扣分阈值10%" },
    ];
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(94))
      .force("charge", d3.forceManyBody().strength(-360))
      .force("center", d3.forceCenter(width / 2, height / 2));
    const link = svg.append("g").attr("stroke", "rgba(0,31,63,.22)").selectAll("line").data(links).join("line").attr("stroke-width", 1.5);
    const drag = d3.drag()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    const g = svg.append("g").selectAll("g").data(nodes).join("g").call(drag);
    g.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => d.group === 0 ? "#001F3F" : d.id.includes("10") ? "#7B1113" : "#ffffff")
      .attr("stroke", d => d.group === 0 || d.id.includes("10") ? "#ffffff" : "#7B1113")
      .attr("stroke-width", 2)
      .append("title").text(d => d.detail || d.id);
    const labels = g.append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 9.5)
      .attr("font-weight", 800)
      .attr("fill", d => d.group === 0 || d.id.includes("10") ? "#fff" : "#001F3F");
    labels.each(function(d) {
      const lines = labelLines(d.id);
      d3.select(this).selectAll("tspan").data(lines).join("tspan")
        .attr("x", 0)
        .attr("dy", (_, i) => i === 0 ? `${-(lines.length - 1) * 0.55}em` : "1.1em")
        .text(line => line);
    });
    sim.on("tick", () => {
      nodes.forEach(d => {
        const pad = d.r + 10;
        d.x = Math.max(pad, Math.min(width - pad, d.x));
        d.y = Math.max(pad, Math.min(height - pad, d.y));
      });
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      g.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    return () => sim.stop();
  }, [abnormalTypes]);
  return html`<svg className="chart" ref=${ref}></svg>`;
}

function TrendLine({ rows }) {
  const ref = useRef(null);
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const node = ref.current;
    const width = node.clientWidth || 600;
    const height = node.clientHeight || 300;
    const margin = { top: 44, right: 28, bottom: 42, left: 46 };
    const dates = ["3/26", "4/10", "4/25", "5/10", "5/25", "6/10", "6/30"];
    const base = d3.mean(rows, d => d.actual / d.target) || 0.7;
    const data = dates.map((d, i) => ({ date: d, value: Math.min(2, base * (0.58 + i * 0.09) + Math.sin(i) * 0.04) }));
    const x = d3.scalePoint().domain(dates).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 2]).range([height - margin.bottom, margin.top]);
    const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveCatmullRom.alpha(0.5));
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}x`));
    const path = svg.append("path").datum(data).attr("fill", "none").attr("stroke", "#7B1113").attr("stroke-width", 3).attr("d", line);
    const len = path.node().getTotalLength();
    path.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len).transition().duration(900).attr("stroke-dashoffset", 0);
    svg.append("g").selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.date)).attr("cy", d => y(d.value)).attr("r", 4).attr("fill", "#001F3F")
      .append("title").text(d => `${d.date}: ${d.value.toFixed(2)}x`);
    svg.append("g").selectAll("text").data(data).join("text")
      .attr("x", d => x(d.date))
      .attr("y", d => Math.max(margin.top - 16, y(d.value) - 12))
      .attr("text-anchor", "middle")
      .attr("font-size", width < 480 ? 10 : 12)
      .attr("font-weight", 850)
      .attr("fill", "#001F3F")
      .text(d => `${d.value.toFixed(2)}x`);
  }, [rows]);
  return html`<svg className="chart" ref=${ref}></svg>`;
}

function InteractiveMap({ rows, selected, setSelected }) {
  const current = selected || rows[0];
  const regionGroups = Array.from(d3.group(rows, d => d.region), ([region, offices]) => {
    const completion = d3.mean(offices, d => d.actual / Math.max(d.target, 1)) || 0;
    const abnormal = d3.mean(offices, d => d.abnormal) || 0;
    return { region, offices, completion, abnormal };
  }).sort((a, b) => d3.ascending(a.region, b.region));
  const activeRegion = current?.region || regionGroups[0]?.region;
  const activeGroup = regionGroups.find(group => group.region === activeRegion) || regionGroups[0];
  return html`
    <div className="office-map">
      <div className="region-rail">
        ${regionGroups.map(group => html`
          <button
            key=${group.region}
            className=${`region-pill ${group.region === activeRegion ? "active" : ""}`}
            onMouseEnter=${() => setSelected(group.offices[0])}
            onClick=${() => setSelected(group.offices[0])}
          >
            <span>${group.region}</span>
            <small>${group.offices.length}个办事处 · 完成${pct(group.completion)}</small>
          </button>
        `)}
      </div>
      <div className="office-map-body">
        <div className="office-list" aria-label="办事处列表">
          ${activeGroup.offices.map(row => {
            const completion = row.actual / Math.max(row.target, 1);
            const qualified = row.qualifiedWorks / Math.max(row.totalWorks, 1);
            const risk = row.abnormal >= 0.1 ? "danger" : row.abnormal >= 0.08 ? "warn" : "good";
            return html`
              <button
                key=${row.office}
                className=${`office-row ${current.office === row.office ? "active" : ""}`}
                onMouseEnter=${() => setSelected(row)}
                onClick=${() => setSelected(row)}
              >
                <span className="office-row-top">
                  <strong>${row.office}</strong>
                  <em className=${risk}>异常${pct(row.abnormal)}</em>
                </span>
                <span className="office-meter" aria-hidden="true">
                  <span style=${{ width: `${Math.min(100, completion * 100)}%` }}></span>
                </span>
                <span className="office-row-meta">
                  <span>目标 ${fmt(row.target)}</span>
                  <span>完成 ${pct(completion)}</span>
                  <span>达标 ${pct(qualified)}</span>
                </span>
              </button>
            `;
          })}
        </div>
        <div className="office-detail">
          <span className="card-icon"><${Icons.MapPinned} /></span>
          <h4>${current.region} / ${current.office}</h4>
          <p>${current.cities || "管辖区域见附件3"}</p>
          <div className="metric-grid small">
            <div><strong>${fmt(current.target)}</strong><span>KOS指标</span></div>
            <div><strong>${fmt(current.actual)}</strong><span>当前完成</span></div>
            <div><strong>${pct(current.actual / Math.max(current.target, 1))}</strong><span>完成率</span></div>
            <div><strong>${pct(current.qualifiedWorks / Math.max(current.totalWorks, 1))}</strong><span>达标率</span></div>
            <div><strong>${fmt(current.top1000)}</strong><span>TOP入围</span></div>
            <div><strong>${pct(current.abnormal)}</strong><span>异常率</span></div>
          </div>
          <p className="map-note">办事处按全国营销大区归属分组；品牌KOS目标请联动查看下方品牌指标矩阵。</p>
        </div>
      </div>
    </div>
  `;
}

function Matrix({ brandTargets }) {
  const regions = brandTargets.filter(d => d["营销大区"] !== "合计");
  const totalRow = brandTargets.find(d => d["营销大区"] === "合计");
  const brands = ["五粮春", "尖庄", "五粮醇", "特头曲", "成长品牌", "品资中心", "合计"];
  const max = d3.max(regions.flatMap(r => brands.map(b => Number(r[b]) || 0))) || 1;
  const [selectedRegion, setSelectedRegion] = useState(regions[0]?.["营销大区"] || "");
  const selected = regions.find(region => region["营销大区"] === selectedRegion) || regions[0];
  return html`
    <div className="matrix-panel">
      ${totalRow && html`
        <div className="matrix-total">
          <span>全国品牌KOS数量发展指标合计</span>
          <strong>${fmt(Number(totalRow["合计"]) || 0)}</strong>
          <small>五粮春 ${fmt(totalRow["五粮春"])} · 尖庄 ${fmt(totalRow["尖庄"])} · 五粮醇 ${fmt(totalRow["五粮醇"])} · 特头曲 ${fmt(totalRow["特头曲"])} · 成长品牌 ${fmt(totalRow["成长品牌"])} · 品资中心 ${fmt(totalRow["品资中心"])}</small>
        </div>
      `}
      <div className="region-jumpbar" aria-label="营销大区选择">
        ${regions.map(region => html`
          <button className=${region["营销大区"] === selected?.["营销大区"] ? "active" : ""} key=${region["营销大区"]} onClick=${() => setSelectedRegion(region["营销大区"])}>
            ${region["营销大区"]}<small>${fmt(region["合计"])}</small>
          </button>
        `)}
      </div>
      ${selected && html`
        <div className="matrix-selected">
          <div>
            <span>当前查看</span>
            <strong>${selected["营销大区"]}</strong>
            <small>点击上方大区后，下方矩阵同步高亮，不再通过滚动定位。</small>
          </div>
          ${brands.map(brand => html`
            <div key=${brand}>
              <span>${brand}</span>
              <strong>${fmt(Number(selected[brand]) || 0)}</strong>
            </div>
          `)}
        </div>
      `}
      <div className="matrix matrix-scroll">
        <div className="matrix-row matrix-head">
          <div className="matrix-cell matrix-label">营销大区</div>
          ${brands.map(b => html`<div className="matrix-cell matrix-label" key=${b}>${b}</div>`)}
        </div>
        ${regions.map(region => html`
          <div className=${`matrix-row ${region["营销大区"] === selected?.["营销大区"] ? "selected" : ""}`} key=${region["营销大区"]}>
            <div className="matrix-cell matrix-label">${region["营销大区"]}</div>
            ${brands.map(b => {
              const value = Number(region[b]) || 0;
              const color = b === "合计" ? "#001F3F" : d3.interpolateRgb("#0f766e", "#7B1113")(value / max);
              return html`<div className="matrix-cell" key=${b} style=${{ background: color }} title=${`${region["营销大区"]} ${b}: ${value}`}>${fmt(value)}</div>`;
            })}
          </div>
        `)}
        ${totalRow && html`
          <div className="matrix-row matrix-summary">
            <div className="matrix-cell matrix-label">全国合计</div>
            ${brands.map(b => html`<div className="matrix-cell" key=${b}>${fmt(Number(totalRow[b]) || 0)}</div>`)}
          </div>
        `}
      </div>
    </div>
  `;
}

function ChartExplain({ children }) {
  return html`<p className="chart-explain">${children}</p>`;
}

function normalizeMetricRows(rows, type) {
  const required = type === "office" ? ["region", "office"] : ["brand"];
  return rows
    .filter(row => required.every(key => String(row[key] ?? "").trim()))
    .map(row => {
      const normalized = {
        target: numericValue(row.target),
        actual: numericValue(row.actual),
        totalWorks: numericValue(row.totalWorks),
        qualifiedWorks: numericValue(row.qualifiedWorks),
        top1000: numericValue(row.top1000),
        abnormal: numericValue(row.abnormal),
      };
      if (type === "office") {
        normalized.region = String(row.region || "").trim();
        normalized.office = String(row.office || "").trim();
        if (row.cities) normalized.cities = String(row.cities).trim();
      } else {
        normalized.brand = String(row.brand || "").trim();
      }
      return normalized;
    });
}

function xlsxToPayload(arrayBuffer, fallbackMetrics) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetByName = candidates => candidates.map(name => workbook.Sheets[name]).find(Boolean);
  const officeSheet = sheetByName(["officeMetrics", "办事处数据", "办事处"]);
  const brandSheet = sheetByName(["brandMetrics", "品牌数据", "品牌"]);
  if (!officeSheet && !brandSheet) throw new Error("Excel中未找到 officeMetrics 或 brandMetrics 工作表");
  const officeRows = officeSheet ? XLSX.utils.sheet_to_json(officeSheet, { defval: "" }) : [];
  const brandRows = brandSheet ? XLSX.utils.sheet_to_json(brandSheet, { defval: "" }) : [];
  return {
    officeMetrics: normalizeMetricRows(officeRows, "office").length ? normalizeMetricRows(officeRows, "office") : fallbackMetrics.offices,
    brandMetrics: normalizeMetricRows(brandRows, "brand").length ? normalizeMetricRows(brandRows, "brand") : fallbackMetrics.brands,
  };
}

function aggregateRegions(offices) {
  return Array.from(d3.group(offices, d => d.region), ([regionName, group]) => ({
    region: regionName,
    office: regionName,
    target: d3.sum(group, d => d.target || 0),
    actual: d3.sum(group, d => d.actual || 0),
    totalWorks: d3.sum(group, d => d.totalWorks || 0),
    qualifiedWorks: d3.sum(group, d => d.qualifiedWorks || 0),
    top1000: d3.sum(group, d => d.top1000 || 0),
    abnormal: d3.mean(group, d => d.abnormal || 0) || 0,
  })).sort((a, b) => d3.descending(a.target, b.target));
}

function DataViz({ data, metrics, setMetrics, toast, setDrawer }) {
  const [scope, setScope] = useState("office");
  const [region, setRegion] = useState("全部");
  const [mode, setMode] = useState("completion");
  const [uploadName, setUploadName] = useState("尚未上传，当前为内置演示样例");
  const [mapSelected, setMapSelected] = useState(metrics.offices[0]);
  const regions = ["全部", ...Array.from(new Set([...data.officeTargets.map(d => d.region), ...metrics.offices.map(d => d.region)]))];
  const rows = useMemo(() => {
    const base = scope === "brand" ? metrics.brands : metrics.offices;
    if (scope === "brand") return base;
    if (region === "全部") return aggregateRegions(base);
    return base.filter(d => d.region === region);
  }, [scope, region, metrics]);
  const nationalTarget = data.brandTargets.find(row => row["营销大区"] === "合计")?.["合计"] || d3.sum(data.officeTargets, d => d.target);
  const nationalCompletion = d3.mean(metrics.offices, d => d.actual / Math.max(d.target, 1)) || 0;
  const nationalQualified = d3.mean(metrics.offices, d => d.qualifiedWorks / Math.max(d.totalWorks, 1)) || 0;
  const nationalAbnormal = d3.mean(metrics.offices, d => d.abnormal) || 0;

  const applyPayload = payload => {
    const next = {
      offices: payload.officeMetrics || payload.offices || metrics.offices,
      brands: payload.brandMetrics || payload.brands || metrics.brands,
    };
    setMetrics(next);
    setMapSelected(next.offices[0] || null);
    setUploadName(payload.__sourceName || "已上传Excel数据");
    toast("数据已更新，图表和公式已重新计算");
  };

  return html`
    <section id="viz" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="数据可视化"
          title="指标、异常、归属与实时更新"
          body="目标指标来自二季度规则附件；完成率、达标率、TOP入围和异常率可通过上传最新数据刷新。默认展示为全国口径，不默认聚焦单一大区。"
        />
        <div className="card pad reveal">
          <div className="scope-banner">
            <div>
              <span>竞赛采集期</span>
              <strong>2026.03.26 00:00 - 2026.06.30 24:00</strong>
              <p>这是二季度采集期。页面内置完成数据只是演示样例；上传Excel后才代表导出时点的当前完成情况。</p>
            </div>
            <div>
              <span>全国目标合计</span>
              <strong>${fmt(nationalTarget)}</strong>
              <p>来自“各营销大区品牌KOS数量发展指标”附件合计。</p>
            </div>
            <div>
              <span>当前数据状态</span>
              <strong>${pct(nationalCompletion)}</strong>
              <p>${uploadName}；达标 ${pct(nationalQualified)} · 异常 ${pct(nationalAbnormal)}。</p>
            </div>
          </div>
          <div className="update-guide">
            <div>
              <strong>上传格式</strong>
              <span>只上传Excel：使用模板文件 .xlsx。Word不能上传；其他非结构化入口已隐藏，避免格式混乱。</span>
            </div>
            <div>
              <strong>模板工作表</strong>
              <span>officeMetrics已预置45个办事处；brandMetrics已预置6个品牌。表头必须保留英文名，页面按表头读取并即时重算。</span>
            </div>
            <div>
              <strong>更新步骤</strong>
              <span>下载Excel模板，把SmartBI或创作中心导出的最新数据填入对应表，点击“上传Excel数据”。异常率填0.08或8%均可。</span>
            </div>
          </div>
          <div className="filters">
            <label className="field">
              <span>数据范围</span>
              <select value=${scope} onChange=${e => setScope(e.currentTarget.value)}>
                <option value="office">办事处</option>
                <option value="brand">品牌</option>
              </select>
            </label>
            <label className="field">
              <span>营销大区</span>
              <select value=${region} disabled=${scope === "brand"} onChange=${e => setRegion(e.currentTarget.value)}>
                ${regions.map(r => html`<option key=${r} value=${r}>${r}</option>`)}
              </select>
            </label>
            <label className="field">
              <span>柱状图指标</span>
              <select value=${mode} onChange=${e => setMode(e.currentTarget.value)}>
                <option value="completion">完成率</option>
                <option value="qualified">达标率</option>
              </select>
            </label>
            <button className="btn secondary" onClick=${() => setDrawer({ title: "Excel上传说明", body: "下载并使用 data/3k-q2-data-template.xlsx。\nofficeMetrics 表：region、office、target、actual、totalWorks、qualifiedWorks、top1000、abnormal、dataDate、sourceNote。\nbrandMetrics 表：brand、target、actual、totalWorks、qualifiedWorks、top1000、abnormal、dataDate、sourceNote。\nactual 是二季度采集期内截至导出时点的有效完成数；totalWorks 是作品总数；qualifiedWorks 是达标作品数；top1000 是入围次数；abnormal 是异常作品率。\n异常率可填0.08或8%。上传后柱状图、折线图、热力图、地图和指标卡即时刷新。页面默认样例不代表一季度或二季度真实完成。" })}>
              <${Icons.Info} /> 字段说明
            </button>
            <a className="btn primary" href="./data/3k-q2-data-template.xlsx" download><${Icons.Download} /> 下载Excel模板</a>
            <label className="btn secondary">
              <${Icons.Upload} /> 上传Excel数据
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange=${async e => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                try {
                  const buffer = await file.arrayBuffer();
                  const payload = xlsxToPayload(buffer, metrics);
                  payload.__sourceName = `${file.name} 已加载`;
                  applyPayload(payload);
                } catch (err) {
                  toast(`Excel解析失败：${err.message}`);
                }
              }} />
            </label>
          </div>
          <details className="update-detail">
            <summary><${Icons.Table} /> Excel模板字段预览</summary>
            <div className="field-preview">
              <div><strong>officeMetrics</strong><span>region、office、target、actual、totalWorks、qualifiedWorks、top1000、abnormal、dataDate、sourceNote</span></div>
              <div><strong>brandMetrics</strong><span>brand、target、actual、totalWorks、qualifiedWorks、top1000、abnormal、dataDate、sourceNote</span></div>
              <div><strong>页面说明</strong><span>全国筛选默认显示17个营销大区汇总；选择某个大区后显示该大区下属办事处。模板已预置45个办事处目标，未上传前为演示样例。</span></div>
            </div>
          </details>
        </div>
        <div className="viz-chart-grid reveal" style=${{ marginTop: "16px" }}>
          <article className="card chart-card">
            <div className="chart-title"><h3>${scope === "brand" ? "品牌" : "办事处"}${mode === "completion" ? "完成率" : "达标率"}柱状图</h3><span>柱顶已标数值</span></div>
            <${BarChart} rows=${rows} mode=${mode} />
            <${ChartExplain}>选择“全部”时，办事处数据按17个全国营销大区汇总；选择单一营销大区时，才展开到该大区办事处。未上传Excel前为演示样例。</${ChartExplain}>
          </article>
          <article className="card chart-card">
            <div className="chart-title"><h3>赛季进度折线</h3><span>节点已标数值 · 采集期3/26-6/30</span></div>
            <${TrendLine} rows=${rows} />
            <${ChartExplain}>按当前筛选对象的平均完成率推演3/26-6/30赛季进度。节点数值为阶段完成倍率，1.00x表示达到目标，2.00x为KOS完成率计分上限。</${ChartExplain}>
          </article>
          <article className="card chart-card">
            <div className="chart-title"><h3>异常与指标热力图</h3><span>大区维度</span></div>
            <${Heatmap} rows=${metrics.offices} />
            <${ChartExplain}>行是营销大区，列是完成、达标、TOP入围和异常。颜色越深代表该项数值越高；异常列越深表示风险越高，8%为过程提示线，超过10%触发扣分口径。</${ChartExplain}>
          </article>
          <article className="card chart-card">
            <div className="chart-title"><h3>异常分类节点图</h3><span>可拖拽节点</span></div>
            <${NetworkGraph} abnormalTypes=${data.rules.abnormalTypes} />
          </article>
        </div>
        <div className="viz-stack reveal" style=${{ marginTop: "16px" }}>
          <article className="card pad viz-wide">
            <div className="chart-title"><h3>全国办事处/品牌归属交互地图</h3><span>Q2采集期 · 全国大区分组</span></div>
            <${ChartExplain}>归属关系来自规则附件3“办事处与地级市对应表”，KOS目标来自附件2；完成、达标、TOP入围、异常率来自当前页面加载的Excel数据。未上传前只是演示样例，不是一季度完成数，也不是二季度真实完成数；上传Excel后代表该文件导出时点的二季度采集期数据。</${ChartExplain}>
            <${InteractiveMap} rows=${metrics.offices} selected=${mapSelected} setSelected=${setMapSelected} />
          </article>
          <article className="card pad viz-wide">
            <div className="chart-title"><h3>2026年第二季度3K运营劳动竞赛各营销大区品牌KOS数量发展指标</h3><span>附件1完整指标 · 支持大区丝滑跳转</span></div>
            <${Matrix} brandTargets=${data.brandTargets} />
            <${ChartExplain}>矩阵来自附件1，行是营销大区，列是五粮春、尖庄、五粮醇、特头曲、成长品牌、品资中心等品牌指标。格子数字是该大区对应品牌的KOS数量发展指标，颜色越深表示指标规模越大。</${ChartExplain}>
          </article>
        </div>
      </div>
    </section>
  `;
}

function Rewards({ data, setDrawer }) {
  return html`
    <section id="rewards" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="激励机制"
          title="奖项、名额、奖金与排名范围"
          body="悬浮翻转看计算口径，点击查看详细赛道排名范围。"
        />
        <div className="flip-grid reveal">
          ${data.rewards.map(row => html`
            <button key=${row["奖励等级"]} className="flip-card" onClick=${() => setDrawer({ title: row["奖励等级"], body: `名额：${row["名额"]}\n赛道排名：${row["赛道排名"]}\n奖金：${row["奖金"]}` })}>
              <span className="flip-inner">
                <span className="flip-face">
                  <span>
                    <span className="card-icon"><${Icons.Trophy} /></span>
                    <h3>${row["奖励等级"]}</h3>
                  </span>
                  <span>
                    <span className="money">${row["奖金"]}</span>
                    <span className="meta-line"><span>${row["名额"]}个名额</span></span>
                  </span>
                </span>
                <span className="flip-face back">
                  <span>
                    <h3>${row["奖励等级"]}</h3>
                    <p>${row["赛道排名"]}</p>
                  </span>
                  <span className="money">${row["奖金"]}</span>
                </span>
              </span>
            </button>
          `)}
        </div>
        <div className="grid-2 reveal" style=${{ marginTop: "16px" }}>
          <article className="card pad">
            <h3>制度性激励</h3>
            <ul className="plain-list">
              <li>年度评优评先时优先推荐劳动竞赛获奖人员，尤其是内部KOC账号运营表现出色人员。</li>
              <li>赛道评分排名靠前的单位人员，获奖结果作为公司干部提拔、员工晋升参考依据。</li>
              <li>人力资源管理部、综合管理部、经营管理部监督落实评优评先、干部提拔、晋升参考激励和1218专项3K奖励设置。</li>
            </ul>
          </article>
          <article className="card pad">
            <h3>排名规则</h3>
            <p>${data.rules.rankingTieBreak}</p>
            <code className="formula">总点赞量 > 总收藏量 > 总播放量 > 总作品数</code>
          </article>
        </div>
      </div>
    </section>
  `;
}

function Duties({ data }) {
  return html`
    <section id="duties" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="职责分工"
          title="从活动策划到数据复盘的协作链路"
          body="部门卡片展示责任边界，流程动画体现从品牌活动到奖励落实的闭环。"
        />
        <div className="grid-4 reveal">
          ${data.duties.map(item => {
            const Icon = getIcon(item.icon, Icons.BriefcaseBusiness);
            return html`
              <article className="card pad interactive" key=${item.department}>
                <span className="card-icon"><${Icon} /></span>
                <h4>${item.department}</h4>
                <ul className="plain-list">${item.tasks.map(task => html`<li key=${task}>${task}</li>`)}</ul>
              </article>
            `;
          })}
        </div>
        <div className="timeline reveal" style=${{ marginTop: "16px" }}>
          ${[
            ["活动策划", "品牌运营部发起品牌任务，提供脚本素材，对优质作品投流加热。"],
            ["招募发布", "营销大区发动办事处招募KOS，组织培训并推动有效发布。"],
            ["数据统计", "品牌管理与市场洞察部运维系统、统计数据、复盘结果。"],
            ["系统迭代", "消费者运营部迭代创作中心和BI看板。"],
            ["转化衔接", "渠道管理部衔接内容创作与线上销售转化链路。"],
            ["公示激励", "工会、财务、人资等部门落实公示、奖励和晋升参考。"],
          ].map(([title, body]) => html`
            <article className="card pad flow-card" key=${title}>
              <h4>${title}</h4>
              <p>${body}</p>
            </article>
          `)}
        </div>
      </div>
    </section>
  `;
}

function Traffic({ data }) {
  return html`
    <section id="traffic" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="流量与优化"
          title="冷启动、兴趣推荐、爆款全域三段闯关"
          body="将公司培训口径中的平台流量池、指标公式、运营技巧转为可视化漏斗与操作清单。"
        />
        <div className="grid-2 reveal">
          <article className="card pad">
            <div className="funnel">
              ${data.traffic.map(stage => html`
                <div className="funnel-stage" key=${stage.stage}>
                  <h3>${stage.stage}</h3>
                  <div className="stage-range">${stage.range}</div>
                  <p>${stage.metrics.join(" / ")}</p>
                </div>
              `)}
            </div>
          </article>
          <article className="card pad">
            <h3>核心公式与操作策略</h3>
            <div className="accordion">
              ${data.traffic.map(stage => html`
                <details className="accordion-item" key=${stage.stage} open=${stage.stage.includes("冷启动")}>
                  <summary className="accordion-trigger">${stage.stage}<${Icons.ChevronDown} /></summary>
                  <div className="accordion-panel">
                    <h4>公式</h4>
                    <ul>${stage.rules.map(rule => html`<li key=${rule}>${rule}</li>`)}</ul>
                    <h4>策略</h4>
                    <ul>${stage.tips.map(tip => html`<li key=${tip}>${tip}</li>`)}</ul>
                  </div>
                </details>
              `)}
            </div>
          </article>
        </div>
        <div className="grid-3 reveal" style=${{ marginTop: "16px" }}>
          ${[
            ["抖音", "流量爆发快，适合打造爆款；内容需强刺激、快节奏，关注白酒社交、送礼场景和有故事感的实用内容。"],
            ["小红书", "搜索流量是核心，内容长尾效应强；强调真实分享、实用攻略、送礼清单和生活方式场景。"],
            ["快手", "社区氛围浓厚，用户忠诚度高；内容更接地气，强调真实和信任，适合深度粉丝运营。"],
          ].map(([title, body]) => html`
            <article className="card pad interactive" key=${title}>
              <span className="card-icon"><${Icons.Smartphone} /></span>
              <h3>${title}</h3>
              <p>${body}</p>
            </article>
          `)}
        </div>
        <div className="grid-3 reveal" style=${{ marginTop: "16px" }}>
          ${[
            ["发布", "优先12-13点、18-21点；BGM轻快热门且无版权争议；添加3-5个垂直小话题。"],
            ["互动", "发布后1-2小时内快速回复评论；文案末尾增加提问，引导用户评论。"],
            ["内容", "封面标题清晰含关键词；黄金3秒直击痛点或制造反差；每周至少3条稳定更新。"],
          ].map(([title, body]) => html`
            <article className="card pad interactive" key=${title}>
              <span className="card-icon"><${Icons.Zap} /></span>
              <h3>${title}</h3>
              <p>${body}</p>
            </article>
          `)}
        </div>
      </div>
    </section>
  `;
}

function JumpModule({ data, setActiveTrack, setDrawer }) {
  const firstOffices = data.officeTargets.slice(0, 45);
  return html`
    <section id="jump" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="分类与跳转"
          title="按赛道、部门、品牌、办事处快速进入"
          body="所有分类均可跳转或打开下钻说明，便于不同角色直接定位自己需要的信息。"
        />
        <div className="grid-2 reveal">
          <article className="card pad">
            <h3>赛道</h3>
            <div className="jump-cloud">
              ${data.rules.tracks.map(t => html`
                <a className="pill" href="#rules" key=${t.name} onClick=${() => setActiveTrack(t.name)}>${t.name}</a>
              `)}
            </div>
          </article>
          <article className="card pad">
            <h3>职责部门</h3>
            <div className="jump-cloud">
              ${data.duties.map(d => html`
                <button className="pill" key=${d.department} onClick=${() => setDrawer({ title: d.department, body: d.tasks.join("\n") })}>${d.department}</button>
              `)}
            </div>
          </article>
          <article className="card pad">
            <h3>品牌</h3>
            <div className="jump-cloud">
              ${["五粮春", "尖庄", "五粮醇", "特头曲", "成长品牌", "品资中心"].map(b => html`
                <a className="pill" href="#viz" key=${b}>${b}</a>
              `)}
            </div>
          </article>
          <article className="card pad office-jump-card">
            <h3>办事处</h3>
            <div className="jump-cloud office-cloud">
              ${firstOffices.map(o => html`
                <button className="pill" key=${o.office} onClick=${() => setDrawer({ title: `${o.region} / ${o.office}`, body: `KOS数量指标：${o.target}\n管辖区域：${o.cities || "详见附件3"}` })}>
                  ${o.office}
                </button>
              `)}
            </div>
          </article>
        </div>
      </div>
    </section>
  `;
}

function Guide({ data }) {
  return html`
    <section id="guide" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="常见问题与操作指南"
          title="从看数、发布到校验的完整操作路径"
          body="培训材料中的系统入口、字段、透视表步骤、多次发布与常见问题均保留在下方。"
        />
        <div className="grid-2 reveal">
          <article className="card pad">
            <h3>看数与导出</h3>
            <p><b>SmartBI：</b>${data.opsGuide.smartbi.url}</p>
            <p><b>创作中心：</b>${data.opsGuide.creatorCenter.url}</p>
            <p><b>下载路径：</b>${data.opsGuide.creatorCenter.path}</p>
            <div className="pill-row">${data.opsGuide.smartbi.metrics.map(m => html`<span className="pill" key=${m}>${m}</span>`)}</div>
          </article>
          <article className="card pad">
            <h3>Excel透视表三步走</h3>
            <ol>${data.opsGuide.pivotSteps.map(step => html`<li key=${step}>${step}</li>`)}</ol>
            <code className="formula">复杂场景可用 XLOOKUP 从发布明细报表补回办事处、手机号、终端编码等字段。</code>
          </article>
        </div>
        <div className="grid-2 reveal" style=${{ marginTop: "16px" }}>
          <article className="card pad guide-dense">
            <h3>多次发布</h3>
            <div className="mini-steps">
              ${data.opsGuide.multiPublish.map((item, index) => html`
                <div className="mini-step" key=${item}>
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <strong>${item}</strong>
                </div>
              `)}
            </div>
          </article>
          <article className="card pad">
            <h3>FAQ</h3>
            <div className="accordion">
              ${data.opsGuide.faq.map(item => html`
                <details className="accordion-item" key=${item.q}>
                  <summary className="accordion-trigger">${item.type}：${item.q}<${Icons.ChevronDown} /></summary>
                  <div className="accordion-panel">${item.a}</div>
                </details>
              `)}
            </div>
          </article>
        </div>
      </div>
    </section>
  `;
}

function DataTable({ title, rows, open = false }) {
  if (!rows?.length) return null;
  const headers = Object.keys(rows[0]).filter(h => !["x", "y", "actual", "published", "qualifiedWorks", "totalWorks", "top1000", "abnormal", "cities"].includes(h));
  return html`
    <details className="card pad reveal source-doc source-table" open=${open}>
      <summary className="source-summary">
        <span>${title}</span>
        <small>${rows.length}条记录</small>
        <${Icons.ChevronDown} />
      </summary>
      <div className="table-wrap">
        <table>
          <thead><tr>${headers.map(h => html`<th key=${h}>${h}</th>`)}</tr></thead>
          <tbody>
            ${rows.map((row, i) => html`<tr key=${i}>${headers.map(h => html`<td key=${h}>${row[h]}</td>`)}</tr>`)}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function SourceLibrary({ data }) {
  const [query, setQuery] = useState("");
  const searchableDocs = useMemo(() => data.sourceDocs
    .filter(doc => ["公司规则正文", "公司培训文本"].includes(doc.name) || doc.name.includes("关于2026年3K运营劳动竞赛第二季度规则发布的规则") || doc.name.includes("【0429】"))
    .map(doc => ({
      ...doc,
      displayName: doc.name.includes("培训") || doc.name.includes("【0429】") ? "公司培训文本" : "公司规则正文",
    })), [data.sourceDocs]);
  const sourceTables = useMemo(() => ([
    { title: "奖励机制附件表", rows: data.rewards },
    { title: "品牌KOS数量发展指标（附件1）", rows: data.brandTargets },
    { title: "办事处KOS数量发展指标（附件2）", rows: data.officeTargets.map(d => ({ 营销大区: d.region, 办事处: d.office, KOS数量指标: d.target })) },
    { title: "KOS所属办事处与地级市对应表（附件3）", rows: data.officeRegions },
  ]), [data]);
  const search = query.trim().toLowerCase();
  const rowMatches = row => Object.values(row).some(value => String(value ?? "").toLowerCase().includes(search));
  const filteredTables = useMemo(() => {
    if (!search) return sourceTables;
    return sourceTables.map(table => ({ ...table, rows: table.rows.filter(rowMatches) })).filter(table => table.rows.length);
  }, [search, sourceTables]);
  const docs = useMemo(() => {
    if (!search) return [];
    return searchableDocs.filter(doc => `${doc.name}\n${doc.content}`.toLowerCase().includes(search));
  }, [search, searchableDocs]);
  const tableMatchCount = filteredTables.reduce((sum, table) => sum + table.rows.length, 0);
  const totalMatches = tableMatchCount + docs.length;
  return html`
    <section id="source" className="section">
      <div className="section-inner">
        <${SectionHead}
          eyebrow="规则核对与附件"
          title="所有规则、公式、表格和培训页索引"
          body="这里只保留公司规则正文、培训文本和附件表的核对入口，不展示原始文件名。默认展示附件表卡片；搜索后展开匹配正文。"
        />
        <label className="field source-search reveal">
          <span>搜索规则、附件、培训页</span>
          <input
            type="search"
            value=${query}
            onInput=${e => setQuery(e.currentTarget.value)}
            onChange=${e => setQuery(e.currentTarget.value)}
            placeholder="输入：异常作品率、达标作品、内部KOC、奖励名额、数据采集时间..."
          />
        </label>
        ${search && html`
          <div className="search-status reveal">
            ${totalMatches ? `找到 ${tableMatchCount} 条附件表记录、${docs.length} 个正文/培训文本结果。` : "没有找到匹配内容，请换一个关键词。"}
          </div>
        `}
        ${filteredTables.map(table => html`<${DataTable} key=${table.title} title=${table.title} rows=${table.rows} open=${Boolean(search)} />`)}
        ${docs.map(doc => html`
          <details className="accordion-item reveal source-doc" key=${doc.name} open=${Boolean(search)}>
            <summary className="accordion-trigger">${doc.displayName}<${Icons.ChevronDown} /></summary>
            <pre className="source-pre">${doc.content}</pre>
          </details>
        `)}
      </div>
    </section>
  `;
}

function Drawer({ drawer, setDrawer }) {
  if (!drawer) return null;
  const lines = String(drawer.body || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
  return html`
    <${React.Fragment}>
      <div className="drawer-backdrop" onClick=${() => setDrawer(null)}></div>
      <aside className="drawer">
        <button className="drawer-close" onClick=${() => setDrawer(null)} aria-label="关闭"><${Icons.X} /></button>
        <div className="drawer-topline">
          <span>3K RULE DETAIL</span>
          <i></i>
        </div>
        <h2>${drawer.title}</h2>
        <div className="drawer-body">
          ${lines.map((line, index) => {
            const [lead, ...rest] = line.split("：");
            const hasLead = rest.length > 0 && lead.length <= 12;
            return html`
              <p key=${index}>
                ${hasLead && html`<strong>${lead}</strong>`}
                <span>${hasLead ? rest.join("：") : line}</span>
              </p>
            `;
          })}
        </div>
      </aside>
    <//>
  `;
}

function App() {
  const [active, setActive] = useState("hero");
  const [activeTrack, setActiveTrack] = useState(DATA.rules.tracks[0].name);
  const [drawer, setDrawer] = useState(null);
  const [toastText, setToastText] = useState("");
  const [metrics, setMetrics] = useState({ offices: DATA.officeTargets, brands: DATA.brandMetrics });
  useSectionAnimation();

  useEffect(() => {
    const ids = ["hero", "rules", "viz", "rewards", "duties", "traffic", "jump", "guide", "source"];
    let frame = null;
    const updateActive = () => {
      const checkpoint = window.innerHeight * 0.34;
      let current = ids[0];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= checkpoint && rect.bottom >= checkpoint) current = id;
      });
      setActive(current);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        updateActive();
      });
    };
    updateActive();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!toastText) return undefined;
    const t = setTimeout(() => setToastText(""), 3200);
    return () => clearTimeout(t);
  }, [toastText]);

  const totals = useMemo(() => {
    const kosTarget = DATA.brandTargets.find(r => r["营销大区"] === "合计")?.["合计"] || d3.sum(DATA.officeTargets, d => d.target);
    const rewardBudget = d3.sum(DATA.rewards, d => (Number(String(d["名额"]).match(/\d+/)?.[0] || 0) * Number(d["奖金数值"] || 0)));
    return {
      units: 6 + 45 + 9,
      kosTarget,
      rewardBudget,
      works: d3.sum(metrics.offices, d => d.totalWorks || 0),
    };
  }, [metrics]);

  return html`
    <div className="app-shell">
      <${ParticleBackground} />
      <div className="light-sweep"></div>
      <${Nav} active=${active} />
      <${MobileDock} active=${active} />
      <main>
        <${Hero} totals=${totals} setDrawer=${setDrawer} />
        <${RuleModule} data=${DATA} activeTrack=${activeTrack} setActiveTrack=${setActiveTrack} setDrawer=${setDrawer} />
        <${DataViz} data=${DATA} metrics=${metrics} setMetrics=${setMetrics} toast=${setToastText} setDrawer=${setDrawer} />
        <${Rewards} data=${DATA} setDrawer=${setDrawer} />
        <${Duties} data=${DATA} />
        <${Traffic} data=${DATA} />
        <${JumpModule} data=${DATA} setActiveTrack=${setActiveTrack} setDrawer=${setDrawer} />
        <${Guide} data=${DATA} />
        <${SourceLibrary} data=${DATA} />
      </main>
      <${Drawer} drawer=${drawer} setDrawer=${setDrawer} />
      ${toastText && html`<div className="toast">${toastText}</div>`}
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
