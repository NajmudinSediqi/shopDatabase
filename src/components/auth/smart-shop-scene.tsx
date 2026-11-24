import { useState } from "react";
import {
  ArrowUpLeft,
  Boxes,
  ChartNoAxesCombined,
  Check,
  CirclePause,
  CirclePlay,
  ReceiptText,
  Sparkles,
} from "lucide-react";

export function SmartShopScene({ signup }: { signup: boolean }) {
  const [paused, setPaused] = useState(false);
  return (
    <section
      className={`auth-story ${paused ? "is-paused" : ""}`}
      dir="rtl"
      aria-labelledby="auth-story-title"
    >
      <div className="auth-story-grid" aria-hidden="true" />
      <div className="auth-story-top">
        <span className="auth-story-pill">
          <Sparkles size={14} /> یک نگاه، همه‌چیز روشن
        </span>
        <span className="auth-story-wordmark" dir="ltr">
          SMART SHOP
        </span>
      </div>
      <div className="auth-story-heading">
        <p>همراه هوشمند کسب‌وکار شما</p>
        <h2 id="auth-story-title">
          فروشگاه‌تان را
         
          <span className='p-2'>یک قدم جلوتر ببرید . </span>
        </h2>
        
      </div>

      <div
        className="auth-scene"
        aria-label="تصویر فروشگاه هوشمند با ارتباط میان فروش، موجودی و گزارش‌ها"
        role="img"
      >
        <svg viewBox="0 0 620 420" fill="none" className="auth-shop-svg" aria-hidden="true">
          <defs>
            <linearGradient
              id="shop-wall"
              x1="211"
              y1="160"
              x2="427"
              y2="329"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F4F4DE" />
              <stop offset="1" stopColor="#D9E8D8" />
            </linearGradient>
            <linearGradient
              id="shop-glass"
              x1="240"
              y1="224"
              x2="360"
              y2="305"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#32776B" />
              <stop offset="1" stopColor="#144D42" />
            </linearGradient>
            <radialGradient id="shop-halo">
              <stop stopColor="#83C2A0" stopOpacity=".19" />
              <stop offset="1" stopColor="#83C2A0" stopOpacity="0" />
            </radialGradient>
            <filter id="shop-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow
                dx="0"
                dy="18"
                stdDeviation="14"
                floodColor="#041F19"
                floodOpacity=".28"
              />
            </filter>
          </defs>
          <ellipse cx="316" cy="238" rx="251" ry="180" fill="url(#shop-halo)" />
          <ellipse cx="316" cy="338" rx="173" ry="28" fill="#092F27" opacity=".45" />
          <g
            className="auth-network"
            stroke="#93C6AD"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            opacity=".5"
          >
            <path d="M183 118H244Q264 118 264 141V164" />
            <path d="M438 156H406Q389 156 389 179V198" />
            <path d="M180 300H212Q235 300 235 279V266" />
            <path d="M438 315H398Q377 315 377 294V283" />
          </g>
          <circle cx="264" cy="155" r="4" fill="#D6B778" className="auth-signal" />
          <circle cx="405" cy="156" r="4" fill="#AADAC1" className="auth-signal auth-delay" />
          <g filter="url(#shop-shadow)">
            <path d="M193 325L316 354L445 324L321 298Z" fill="#316A57" />
            <path d="M193 325V333L316 363V354Z" fill="#235342" />
            <path d="M316 354L445 324V332L316 363Z" fill="#153F33" />
            <rect x="215" y="182" width="205" height="139" rx="9" fill="url(#shop-wall)" />
            <rect x="228" y="220" width="117" height="91" rx="5" fill="#BED6C5" />
            <rect x="234" y="225" width="105" height="79" rx="3" fill="url(#shop-glass)" />
            <path
              d="M243 234H278M243 242H265"
              stroke="#96C3AD"
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".5"
            />
            <path
              d="M250 225L300 304M265 225L315 304"
              stroke="#BDDCCB"
              strokeWidth="12"
              opacity=".07"
            />
            <path d="M232 282H341V304H232Z" fill="#C99C60" />
            <rect x="249" y="269" width="23" height="15" rx="2" fill="#E5C898" />
            <path d="M257 269V277M263 269V277" stroke="#B5864D" strokeWidth="2" />
            <path d="M288 266V282H318V266" fill="#FAEDD0" />
            <path d="M297 267V263C297 257 309 257 309 263V267" stroke="#D6B778" strokeWidth="2" />
            <rect x="355" y="221" width="49" height="100" rx="4" fill="#30715C" />
            <rect x="361" y="227" width="37" height="72" rx="2" fill="#5F9B7D" />
            <path d="M367 234H391V264" stroke="#AED2B4" strokeWidth="2" opacity=".45" />
            <circle cx="392" cy="278" r="2.5" fill="#F1D89F" />
            <path d="M205 179L226 143H406L431 179Z" fill="#F0CC86" />
            <path d="M226 143H255L243 179H205Z" fill="#77A88B" />
            <path d="M284 143H314V179H272Z" fill="#77A88B" />
            <path d="M343 143H373L391 179H350Z" fill="#77A88B" />
            <path d="M406 143L431 179H419L391 143Z" fill="#77A88B" />
            {[205, 243, 281, 319, 357, 395].map((x, i) => (
              <path
                key={x}
                d={`M${x} 179h38v13a19 15 0 0 1-38 0Z`}
                fill={i % 2 ? "#EDD095" : "#609575"}
              />
            ))}
            <rect x="268" y="114" width="100" height="29" rx="6" fill="#E4EBD2" />
            <path d="M285 129H337" stroke="#336C53" strokeWidth="4" strokeLinecap="round" />
            <path
              d="M347 123L352 128L347 133"
              stroke="#7FA880"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="211" y="313" width="215" height="9" rx="3" fill="#B8CBB6" />
          </g>
          <g className="auth-shop-plant">
            <path d="M190 313V274" stroke="#92B98C" strokeWidth="3" />
            <path d="M190 294C168 295 167 278 171 273C187 274 191 282 190 294Z" fill="#6B9D71" />
            <path d="M190 284C188 269 198 258 208 261C210 275 201 283 190 284Z" fill="#9EC08B" />
            <path d="M176 301H204L200 324H181Z" fill="#DDB880" />
          </g>
          <g transform="translate(431 281)">
            <rect width="28" height="36" rx="3" fill="#BC9664" />
            <path d="M14 0V11M1 14H27" stroke="#E1BD87" strokeWidth="2" />
            <path d="M8 28H20" stroke="#8A6C48" strokeWidth="2" />
          </g>
          <circle
            cx="319"
            cy="66"
            r="21"
            fill="#DCC28C"
            fillOpacity=".12"
            stroke="#DCC28C"
            strokeOpacity=".28"
          />
          <path
            d="M319 54L322 63L331 66L322 69L319 78L316 69L307 66L316 63Z"
            fill="#E4C38D"
            className="auth-spark"
          />
          <path d="M486 237l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#B4CBA5" opacity=".6" />
          <circle cx="150" cy="224" r="3" fill="#DFC38B" opacity=".7" />
          <circle cx="466" cy="95" r="3" fill="#B4CBA5" opacity=".5" />
        </svg>
        <div className="auth-scene-card auth-scene-stock">
          <span className="auth-card-icon">
            <Boxes size={20} />
          </span>
          <div>
            <strong>موجودی کالا</strong>
            <span>همیشه به‌روز و دقیق</span>
          </div>
          <Check className="auth-card-check" size={14} />
        </div>
        <div className="auth-scene-card auth-scene-chart">
          <div className="auth-chart-label">
            <span>
              <ChartNoAxesCombined size={16} /> دید روشن‌تر
            </span>
            <ArrowUpLeft size={15} />
          </div>
          <div className="auth-mini-bars" aria-hidden="true">
            {[35, 58, 43, 74, 61, 90, 78].map((height, i) => (
              <i key={i} style={{ height: `${height}%`, animationDelay: `${i * 0.13}s` }} />
            ))}
          </div>
        </div>
        <div className="auth-scene-card auth-scene-receipt">
          <span className="auth-card-icon auth-card-icon-gold">
            <ReceiptText size={20} />
          </span>
          <div>
            <strong>حساب‌های روشن</strong>
            <span>از خرید تا آخرین فروش</span>
          </div>
        </div>
        <div className="auth-scene-status">
          <i />
          <span>{signup ? "یک شروع تازه برای فروشگاه شما" : "فروش، موجودی و حساب‌ها؛ هماهنگ"}</span>
        </div>
      </div>

      <div className="auth-story-bottom">
        <p>
          کمتر درگیر حساب‌ها.
          <br />
          <strong>بیشتر در فکر رشد.</strong>
        </p>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "پخش حرکت تصویر" : "توقف حرکت تصویر"}
          aria-pressed={paused}
        >
          {paused ? <CirclePlay size={20} /> : <CirclePause size={20} />}
        </button>
      </div>
    </section>
  );
}
