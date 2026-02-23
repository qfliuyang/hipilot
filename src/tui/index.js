import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { default as BigText } from 'ink-big-text';
import Gradient from 'ink-gradient';
import Spinner from 'ink-spinner';

// ═══════════════════════════════════════════════════════════════════════════
// DRAMATIC COLOR PALETTE (Dracula-inspired)
// ═══════════════════════════════════════════════════════════════════════════
const COLORS = {
  // Primary
  cyan: '#00d4ff',
  purple: '#bd93f9',
  pink: '#ff79c6',
  green: '#50fa7b',
  yellow: '#ffb86c',
  orange: '#ffb86c',
  red: '#ff5555',
  
  // Backgrounds
  dark: '#1a1a2e',
  darker: '#0d0d1a',
  card: '#16213e',
  
  // Text
  white: '#f8f8f2',
  gray: '#6272a4',
  dim: '#44475a',
};

const ICONS = {
  ok: '+',
  no: 'x',
  warn: '!',
  loading: '~',
  running: '>',
  pending: 'o',
  star: '*',
  arrow: '>',
  bolt: '!',
  gear: '#',
  chip: '*',
};

// Legacy alias
const STATUS_ICONS = ICONS;

function BigBanner({ version }) {
  return React.createElement(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    paddingY: 1,
  },
    React.createElement(Box, { flexDirection: 'column', alignItems: 'center' },
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, 
          '  _    _ _   _ _____ ___  ____   ____ ___  _   _  ___ _   _ _____ ___  ____  '
        )
      ),
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, 
          '  | |  | | \\ | |  ___/ _ \\/ ___| / ___/ _ \\| \\ | |/ _ \\ | | |  ___/ _ \\/ ___| '
        )
      ),
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, 
          '  | |__| |  \\| | |_ | | | \\___ \\| |  | | | |  \\| | | | | | | | |_ | | | \\___ \\ '
        )
      ),
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, 
          '  |  __  | . ` |  _|| |_| |___) | |__| |_| | . ` | |_| | |_| |  _|| |_| |___) |'
        )
      ),
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, 
          '  |_|  |_|_|\\_|_|   \\___/|____/ \\____\\___/|_|\\_|\\___/ \\___/|_|   \\___/|____/ '
        )
      )
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: COLORS.cyan, dimColor: true }, 
        `  v${version}  |  VLSI Physical Design Copilot  |  AI-Powered EDA Assistant  `
      )
    )
  );
}

function AnimatedHeader({ version }) {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  
  const spinnerFrames = ['|', '/', '-', '\\'];
  const spinnerChar = spinnerFrames[frame];
  
  return React.createElement(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    paddingY: 1,
  },
    React.createElement(Box, null,
      React.createElement(Text, { color: COLORS.cyan }, `[${spinnerChar}] `),
      React.createElement(Gradient, { name: 'fruit' },
        React.createElement(Text, { bold: true }, 'HiPilot')
      ),
      React.createElement(Text, { color: COLORS.cyan }, ` [${spinnerChar}]`),
    ),
    React.createElement(Text, {
      color: COLORS.purple,
      italic: true,
    }, `  v${version}  |  VLSI Physical Design Copilot  `)
  );
}

function StatusCard({ icon, label, value, status, accent }) {
  const iconColor = status === 'ok' ? COLORS.green :
                    status === 'no' ? COLORS.red :
                    status === 'warn' ? COLORS.yellow : 
                    status === 'running' ? COLORS.cyan : COLORS.gray;
  
  const borderColor = accent || iconColor;
  
  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: borderColor,
    paddingX: 1,
    marginY: 0,
  },
    React.createElement(Box, null,
      React.createElement(Text, { color: iconColor, bold: true }, `${icon} `),
      React.createElement(Text, { color: COLORS.gray, dimColor: true }, label)
    ),
    React.createElement(Text, { 
      color: status === 'ok' ? COLORS.green : status === 'no' ? COLORS.red : COLORS.white,
      bold: true 
    }, `  ${value}`)
  );
}

function StatusGrid({ items }) {
  const leftCol = items.filter((_, i) => i % 2 === 0);
  const rightCol = items.filter((_, i) => i % 2 === 1);
  
  const renderCard = (item, i) => React.createElement(StatusCard, {
    key: i,
    icon: item.icon,
    label: item.label,
    value: item.value,
    status: item.status,
    accent: item.accent,
  });
  
  return React.createElement(Box, { flexDirection: 'row', paddingX: 1 },
    React.createElement(Box, { flexDirection: 'column', width: 38 },
      ...leftCol.map(renderCard)
    ),
    React.createElement(Box, { flexDirection: 'column', width: 38 },
      ...rightCol.map(renderCard)
    )
  );
}

function QuickStartCard() {
  const steps = [
    { num: '1', cmd: 'hipilot workspace', desc: 'Launch workspace' },
    { num: '2', cmd: 'claude', desc: 'Start Claude Code (left pane)' },
    { num: '3', cmd: 'innovus -nowin', desc: 'Start EDA tool (right pane)' },
    { num: '4', cmd: '/timing', desc: 'Run timing analysis' },
  ];
  
  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'double',
    borderColor: COLORS.purple,
    paddingX: 2,
    paddingY: 1,
    marginX: 2,
  },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: COLORS.pink }, `${ICONS.star} `),
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, 'Quick Start Guide')
      )
    ),
    ...steps.map((step, i) =>
      React.createElement(Box, { key: i, marginY: 0 },
        React.createElement(Box, { width: 3 },
          React.createElement(Gradient, { name: 'fruit' },
            React.createElement(Text, { bold: true }, step.num + '.')
          )
        ),
        React.createElement(Text, { color: COLORS.green, bold: true }, 
          step.cmd.padEnd(22)
        ),
        React.createElement(Text, { color: COLORS.gray, dimColor: true }, 
          `# ${step.desc}`
        )
      )
    )
  );
}

function CommandPalette() {
  const commands = [
    { cmd: '/timing', icon: '⏱', color: COLORS.cyan },
    { cmd: '/drc', icon: '☐', color: COLORS.yellow },
    { cmd: '/power', icon: '⚡', color: COLORS.orange },
    { cmd: '/area', icon: '▢', color: COLORS.purple },
    { cmd: '/compare', icon: '⇄', color: COLORS.pink },
    { cmd: '/history', icon: '◷', color: COLORS.gray },
    { cmd: '/fix-setup', icon: '↑', color: COLORS.green },
    { cmd: '/fix-hold', icon: '↓', color: COLORS.red },
  ];
  
  const leftCol = commands.slice(0, 4);
  const rightCol = commands.slice(4);
  
  const renderCmd = (c, i) => React.createElement(Box, { 
    key: i, 
    marginY: 0,
    borderStyle: 'single',
    borderColor: c.color,
    paddingX: 1,
  },
    React.createElement(Text, { color: c.color }, c.icon + ' '),
    React.createElement(Text, { color: COLORS.white, bold: true }, c.cmd)
  );
  
  return React.createElement(Box, { flexDirection: 'row', paddingX: 2 },
    React.createElement(Box, { flexDirection: 'column', width: 35 },
      ...leftCol.map(renderCmd)
    ),
    React.createElement(Box, { flexDirection: 'column', width: 35 },
      ...rightCol.map(renderCmd)
    )
  );
}

function McpToolsCard() {
  const tools = [
    { name: 'eda.generate_tcl', desc: 'Generate Tcl from intent' },
    { name: 'eda.send_to_terminal', desc: 'Send Tcl to EDA pane' },
    { name: 'eda.quick', desc: 'One-call operations' },
    { name: 'tmux.capture_pane', desc: 'Capture EDA output' },
    { name: 'knowledge.search_docs', desc: 'Search documentation' },
  ];
  
  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: COLORS.cyan,
    paddingX: 2,
    paddingY: 1,
    marginX: 2,
  },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: COLORS.cyan }, `${ICONS.gear} `),
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 'MCP Tools')
    ),
    ...tools.map((tool, i) =>
      React.createElement(Box, { key: i },
        React.createElement(Text, { color: COLORS.gray, dimColor: true }, '  • '),
        React.createElement(Text, { color: COLORS.purple, bold: true }, 
          tool.name.padEnd(22)
        ),
        React.createElement(Text, { color: COLORS.gray }, tool.desc)
      )
    )
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const timeStr = time.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = time.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
  
  return React.createElement(Box, { paddingX: 2 },
    React.createElement(Text, { color: COLORS.gray, dimColor: true },
      `  ${dateStr} ${timeStr}`
    )
  );
}

function Footer() {
  return React.createElement(Box, { 
    flexDirection: 'column', 
    alignItems: 'center',
    marginTop: 2,
  },
    React.createElement(Text, { color: COLORS.dim }, 
      '─'.repeat(60)
    ),
    React.createElement(Box, null,
      React.createElement(Text, { color: COLORS.gray, dimColor: true }, 
        '  Type "hipilot help" for more commands  |  '
      ),
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, null, '* HiPilot')
      ),
      React.createElement(Text, { color: COLORS.gray, dimColor: true }, 
        '  |  Built with '
      ),
      React.createElement(Text, { color: COLORS.red, bold: true }, '<3'),
      React.createElement(Text, { color: COLORS.gray, dimColor: true }, 
        ' for EDA engineers'
      )
    )
  );
}

function Header({ version }) {
  return AnimatedHeader({ version });
}

function StatusItem({ icon, label, value, status }) {
  const color = status === 'ok' ? COLORS.green :
                status === 'no' ? COLORS.red :
                status === 'warn' ? COLORS.yellow : COLORS.gray;
  
  return React.createElement(Box, { marginY: 0 },
    React.createElement(Text, { color, bold: true }, `  ${icon} `),
    React.createElement(Text, { color: COLORS.gray }, `${label}: `),
    React.createElement(Text, { color: COLORS.white }, value)
  );
}

function QuickStart() {
  return QuickStartCard();
}

function QuickCommands() {
  return React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
    React.createElement(Text, { bold: true, color: COLORS.cyan }, 'Quick Commands:'),
    React.createElement(Text, null, ''),
    React.createElement(CommandPalette, null)
  );
}

function Divider({ width = 60 }) {
  return React.createElement(Box, { marginY: 1, paddingX: 2 },
    React.createElement(Gradient, { name: 'morning' },
      React.createElement(Text, { dimColor: true }, '═'.repeat(width))
    )
  );
}

function Section({ title, children }) {
  return React.createElement(Box, { 
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: COLORS.purple,
    paddingX: 1,
    marginTop: 1,
  },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Gradient, { name: 'rainbow' },
        React.createElement(Text, { bold: true }, title)
      )
    ),
    children
  );
}

function MetricsTable({ metrics }) {
  if (!metrics || metrics.length === 0) return null;
  
  return React.createElement(Box, { flexDirection: 'column' },
    ...metrics.map((row, i) =>
      React.createElement(Box, { key: i },
        React.createElement(Text, { 
          color: COLORS.gray, 
          dimColor: true 
        }, `  ${(row.label || row[0]).padEnd(20)}`),
        React.createElement(Text, { 
          color: row.value < 0 ? COLORS.red : 
                 row.value > 0 ? COLORS.green : COLORS.white,
          bold: true
        }, String(row.value || row[1]))
      )
    )
  );
}

function TclBlock({ code, trust, filename }) {
  return React.createElement(Box, { 
    flexDirection: 'column',
    borderStyle: 'double',
    borderColor: trust ? COLORS.green : COLORS.yellow,
    paddingX: 1,
  },
    React.createElement(Box, null,
      React.createElement(Text, { bold: true, color: COLORS.cyan }, `${ICONS.chip} Generated Tcl`),
      trust && React.createElement(Text, { color: COLORS.green }, ` ${ICONS.ok} Template`),
      filename && React.createElement(Text, { color: COLORS.gray, dimColor: true }, ` → ${filename}`)
    ),
    React.createElement(Text, { color: COLORS.white, marginTop: 1 }, code)
  );
}

function LoadingSpinner({ message }) {
  return React.createElement(Box, { marginY: 1 },
    React.createElement(Gradient, { name: 'rainbow' },
      React.createElement(Text, null,
        React.createElement(Spinner, { type: 'dots' })
      )
    ),
    React.createElement(Text, { color: COLORS.cyan, bold: true }, ` ${message}`)
  );
}

function ActivityFeed({ activities }) {
  if (!activities || activities.length === 0) return null;
  
  const iconColor = (status) => {
    switch (status) {
      case 'success': return COLORS.green;
      case 'error': return COLORS.red;
      case 'pending': return COLORS.yellow;
      case 'running': return COLORS.cyan;
      default: return COLORS.gray;
    }
  };

  return React.createElement(Box, { 
    flexDirection: 'column', 
    marginTop: 1,
    borderStyle: 'round',
    borderColor: COLORS.pink,
    paddingX: 2,
  },
    React.createElement(Text, { bold: true, color: COLORS.pink }, `${ICONS.running} Recent Activity`),
    React.createElement(Text, null, ''),
    ...activities.slice(0, 5).map((act, i) =>
      React.createElement(Box, { key: i },
        React.createElement(Text, { color: iconColor(act.status) }, 
          `  ${ICONS[act.status] || '•'} `
        ),
        React.createElement(Text, { color: COLORS.white }, act.message),
        React.createElement(Text, { color: COLORS.gray, dimColor: true }, 
          ` (${act.time})`
        )
      )
    )
  );
}

export {
  BigBanner,
  AnimatedHeader,
  StatusCard,
  StatusGrid,
  QuickStartCard,
  CommandPalette,
  McpToolsCard,
  LiveClock,
  Footer,
  Header,
  StatusItem,
  QuickStart,
  QuickCommands,
  Divider,
  Section,
  MetricsTable,
  TclBlock,
  LoadingSpinner,
  ActivityFeed,
  COLORS,
  ICONS,
  STATUS_ICONS
};
