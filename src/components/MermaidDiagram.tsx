import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polygon, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { GitFork } from 'lucide-react-native';

import { colors, fonts, radii } from '../theme';

type DiagramNode = {
  id: string;
  label: string;
  shape: 'rectangle' | 'diamond' | 'pill';
};

type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

type Position = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const parseToken = (raw: string): DiagramNode | null => {
  const token = raw.trim().replace(/;$/, '');
  const match = token.match(/^([A-Za-z0-9_-]+)\s*(?:\[([^\]]+)\]|\{([^}]+)\}|\(([^)]+)\))?/);
  if (!match) return null;

  const [, id, rectangleLabel, diamondLabel, pillLabel] = match;
  return {
    id,
    label: (rectangleLabel || diamondLabel || pillLabel || id).replace(/^['"]|['"]$/g, ''),
    shape: diamondLabel ? 'diamond' : pillLabel ? 'pill' : 'rectangle',
  };
};

const parseDiagram = (source: string) => {
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];

  source.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || /^(flowchart|graph)\s+/i.test(line) || line.startsWith('%%')) return;

    const edge = line.match(/^(.+?)\s*-->\s*(?:\|([^|]+)\|\s*)?(.+)$/);
    if (edge) {
      const from = parseToken(edge[1]);
      const to = parseToken(edge[3]);
      if (!from || !to) return;
      nodes.set(from.id, nodes.has(from.id) && from.label === from.id ? nodes.get(from.id)! : from);
      nodes.set(to.id, nodes.has(to.id) && to.label === to.id ? nodes.get(to.id)! : to);
      edges.push({ from: from.id, to: to.id, label: edge[2]?.trim() });
      return;
    }

    const standalone = parseToken(line);
    if (standalone) nodes.set(standalone.id, standalone);
  });

  return { nodes: Array.from(nodes.values()), edges };
};

const labelLines = (label: string) => {
  if (label.length <= 19) return [label];
  const words = label.split(/\s+/);
  const first: string[] = [];
  const second: string[] = [];
  words.forEach((word) => {
    if (`${first.join(' ')} ${word}`.trim().length <= 17 && second.length === 0) first.push(word);
    else second.push(word);
  });
  return [first.join(' '), second.join(' ').slice(0, 22)];
};

export function MermaidDiagram({ source, darkMode = false }: { source: string; darkMode?: boolean }) {
  const diagram = useMemo(() => parseDiagram(source), [source]);
  const palette = darkMode
    ? {
        canvas: '#181E1A',
        header: '#1F2722',
        paper: '#222B25',
        soft: '#2B3931',
        ink: '#E8ECE8',
        inkSoft: '#B8C1BB',
        line: '#3D4A42',
        accent: '#A8CAB4',
      }
    : {
        canvas: '#F7F8F4',
        header: colors.paperStrong,
        paper: colors.paperStrong,
        soft: colors.sand,
        ink: colors.ink,
        inkSoft: colors.inkSoft,
        line: colors.lineStrong,
        accent: colors.moss,
      };
  const layout = useMemo(() => {
    const width = 350;
    const depths = new Map<string, number>();
    diagram.nodes.forEach((node) => depths.set(node.id, 0));

    for (let pass = 0; pass < diagram.nodes.length; pass += 1) {
      diagram.edges.forEach((edge) => {
        if (edge.from === edge.to) return;
        const next = Math.min((depths.get(edge.from) || 0) + 1, diagram.nodes.length - 1);
        if (next > (depths.get(edge.to) || 0)) depths.set(edge.to, next);
      });
    }

    const levels = new Map<number, DiagramNode[]>();
    diagram.nodes.forEach((node) => {
      const depth = depths.get(node.id) || 0;
      levels.set(depth, [...(levels.get(depth) || []), node]);
    });

    const positions = new Map<string, Position>();
    Array.from(levels.entries()).forEach(([depth, levelNodes]) => {
      const gap = 12;
      const nodeWidth = levelNodes.length === 1 ? 206 : levelNodes.length === 2 ? 150 : 102;
      const totalWidth = levelNodes.length * nodeWidth + Math.max(0, levelNodes.length - 1) * gap;
      levelNodes.forEach((node, index) => {
        positions.set(node.id, {
          x: (width - totalWidth) / 2 + index * (nodeWidth + gap),
          y: 28 + depth * 112,
          width: nodeWidth,
          height: 54,
        });
      });
    });

    const maxDepth = Math.max(0, ...Array.from(depths.values()));
    return { width, height: 28 + maxDepth * 112 + 85, positions };
  }, [diagram]);

  if (diagram.nodes.length === 0) {
    return (
      <View style={[styles.fallback, darkMode && styles.fallbackDark]}>
        <Text style={styles.fallbackText}>{source.trim()}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas, borderColor: palette.line }]}>
      <View style={[styles.header, { backgroundColor: palette.header, borderBottomColor: palette.line }]}>
        <View style={styles.headerTitleRow}>
          <GitFork size={14} color={palette.accent} />
          <Text style={[styles.headerTitle, { color: palette.accent }]}>FLOWCHART</Text>
        </View>
        <View style={styles.nativeBadge}>
          <View style={styles.nativeDot} />
          <Text style={[styles.nativeText, { color: palette.inkSoft }]}>NATIVE</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
          {diagram.edges.map((edge, index) => {
            const from = layout.positions.get(edge.from);
            const to = layout.positions.get(edge.to);
            if (!from || !to) return null;
            const startX = from.x + from.width / 2;
            const startY = from.y + from.height;
            const endX = to.x + to.width / 2;
            const endY = to.y;
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            return (
              <React.Fragment key={`${edge.from}-${edge.to}-${index}`}>
                <Line x1={startX} y1={startY} x2={endX} y2={endY - 6} stroke={palette.accent} strokeWidth={1.6} />
                <Polygon
                  points={`${endX - 4},${endY - 8} ${endX + 4},${endY - 8} ${endX},${endY - 1}`}
                  fill={palette.accent}
                />
                {edge.label ? (
                  <>
                    <Rect x={midX - 20} y={midY - 10} width={40} height={17} rx={8} fill={palette.canvas} />
                    <SvgText
                      x={midX}
                      y={midY + 2}
                      fontFamily={fonts.semibold}
                      fontSize={8.5}
                      fill={palette.inkSoft}
                      textAnchor="middle"
                    >
                      {edge.label.slice(0, 10)}
                    </SvgText>
                  </>
                ) : null}
              </React.Fragment>
            );
          })}

          {diagram.nodes.map((node) => {
            const position = layout.positions.get(node.id)!;
            const centerX = position.x + position.width / 2;
            const centerY = position.y + position.height / 2;
            const lines = labelLines(node.label);

            return (
              <React.Fragment key={node.id}>
                {node.shape === 'diamond' ? (
                  <Polygon
                    points={`${centerX},${position.y - 4} ${position.x + position.width},${centerY} ${centerX},${position.y + position.height + 4} ${position.x},${centerY}`}
                    fill={palette.soft}
                    stroke={palette.accent}
                    strokeWidth={1.4}
                  />
                ) : (
                  <Rect
                    x={position.x}
                    y={position.y}
                    width={position.width}
                    height={position.height}
                    rx={node.shape === 'pill' ? 27 : 13}
                    fill={node.shape === 'pill' ? palette.soft : palette.paper}
                    stroke={palette.line}
                    strokeWidth={1.2}
                  />
                )}
                <SvgText
                  x={centerX}
                  y={centerY - (lines.length - 1) * 7 + 4}
                  fontFamily={fonts.semibold}
                  fontSize={10.5}
                  fill={palette.ink}
                  textAnchor="middle"
                >
                  {lines.map((line, index) => (
                    <TSpan key={`${node.id}-${index}`} x={centerX} dy={index === 0 ? 0 : 14}>
                      {line}
                    </TSpan>
                  ))}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 17,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: '#F7F8F4',
    overflow: 'hidden',
  },
  header: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paperStrong,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  nativeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nativeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#5A9A6B',
  },
  nativeText: {
    color: colors.inkFaint,
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 0.9,
  },
  scrollContent: {
    minWidth: '100%',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  fallback: {
    width: '100%',
    marginVertical: 15,
    padding: 16,
    borderRadius: radii.sm,
    backgroundColor: '#202622',
  },
  fallbackText: {
    color: '#E7ECE8',
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  fallbackDark: {
    backgroundColor: '#101512',
    borderWidth: 1,
    borderColor: '#303933',
  },
});
