import React from 'react';

/**
 * MonitoringBackground — a still, hairline topographic texture.
 *
 * The previous version layered drifting radial colour blobs, a perspective
 * grid and a sweeping scan line behind every page. That constant movement is
 * a primary driver of the "AI-generated site" read, so it has been removed.
 *
 * What remains is a single static contour field, drawn at ~4-6% opacity and
 * anchored to the edges of the viewport so it never sits underneath the
 * content column. It reads as engineered paper stock rather than as an effect.
 *
 * Decorative only (aria-hidden). No animation, so it costs nothing to paint
 * and never competes with operational data for attention.
 */
export const MonitoringBackground: React.FC = () => {
  return (
    <div aria-hidden="true" className="monitoring-bg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* ==== Contour bands — bottom third ==== */}
        <g>
          <path className="mb-contours-gray" d="M -60 690 C 180 630 360 672 560 632 C 760 592 940 642 1140 606 C 1280 582 1420 630 1500 604" />
          <path className="mb-contours" d="M -60 742 C 200 690 400 726 600 692 C 800 658 1000 700 1200 668 C 1320 648 1430 682 1500 662" />
          <path className="mb-contours-teal" d="M -60 796 C 220 748 420 782 620 750 C 820 718 1020 758 1220 728 C 1336 710 1440 740 1500 722" />
          <path className="mb-contours-gray" d="M -60 850 C 240 806 440 838 640 808 C 840 778 1040 816 1240 786 C 1350 770 1444 796 1500 780" />
          <path className="mb-contours" d="M -60 902 C 260 862 460 892 660 862 C 860 832 1060 868 1260 840 C 1362 826 1450 848 1500 834" />
        </g>

        {/* ==== Contour bands — top third ==== */}
        <g>
          <path className="mb-contours-gray" d="M -60 96 C 240 56 420 96 640 62 C 840 32 1000 96 1210 60 C 1340 36 1450 88 1510 64" />
          <path className="mb-contours" d="M -60 42 C 260 6 460 40 660 8 C 860 -24 1080 34 1280 4 C 1390 -14 1460 24 1510 8" />
        </g>

        {/* ==== Closed contour "high ground" formations ==== */}
        <g>
          <ellipse className="mb-contours-teal" cx="1214" cy="196" rx="188" ry="82" />
          <ellipse className="mb-contours" cx="1214" cy="196" rx="126" ry="55" />
          <ellipse className="mb-contours-gray" cx="1214" cy="196" rx="66" ry="28" />

          <ellipse className="mb-contours-gray" cx="236" cy="792" rx="212" ry="88" />
          <ellipse className="mb-contours" cx="236" cy="792" rx="142" ry="58" />

          <ellipse className="mb-contours" cx="1330" cy="742" rx="150" ry="62" />
        </g>

        {/* ==== Survey nodes: sparse, tiny, low contrast ==== */}
        <g>
          {[
            [150, 246], [268, 452], [430, 208], [536, 548], [652, 330],
            [806, 486], [922, 172], [1064, 372], [1198, 604], [1362, 478],
            [466, 706], [1044, 640], [224, 118],
          ].map(([cx, cy], i) => (
            <circle
              key={i}
              className={i % 7 === 0 ? 'mb-node-red' : i % 3 === 0 ? 'mb-node-blue' : 'mb-node'}
              cx={cx}
              cy={cy}
              r={i % 4 === 0 ? 1.9 : 1.4}
            />
          ))}
        </g>

        {/* ==== Survey links ==== */}
        <g strokeLinecap="round">
          <path className="mb-flow" d="M 268 452 C 350 418 430 320 466 706" />
          <path className="mb-flow" d="M 652 330 C 712 382 764 434 806 486" />
          <path className="mb-flow" d="M 1064 372 C 1112 432 1158 520 1198 604" />
          <path className="mb-flow" d="M 806 486 C 874 536 954 588 1044 640" />
          <path className="mb-flow-blue" d="M 1064 372 C 1112 310 1160 250 1214 196" />
          <path className="mb-flow-blue" d="M 922 172 C 952 202 1010 292 1064 372" />
          <path className="mb-flow-blue" d="M 150 246 C 202 316 300 274 430 208" />
          <path className="mb-flow-blue" d="M 1362 478 C 1330 546 1300 660 1330 742" />
        </g>
      </svg>
    </div>
  );
};

export default MonitoringBackground;
