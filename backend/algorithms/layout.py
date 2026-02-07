"""
用于代理可视化的2D布局算法。

实现力导向图布局算法，根据代理的社交连接
在2D空间中定位代理。
"""
import random
import math
from typing import Any
from dataclasses import dataclass
from collections import defaultdict

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components

try:
    import igraph as ig
    HAS_IGRAPH = True
except ImportError:
    HAS_IGRAPH = False

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False


@dataclass
class Point2D:
    """一个2D点。"""
    x: float
    y: float

    def distance_to(self, other: "Point2D") -> float:
        """计算到另一个点的欧几里得距离。"""
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)

    def to_tuple(self) -> tuple[float, float]:
        """转换为元组。"""
        return (self.x, self.y)


@dataclass
class LayoutResult:
    """布局算法的结果。"""
    positions: dict[int, Point2D]  # agent_id -> (x, y)
    iterations: int
    converged: bool
    final_energy: float


class ForceDirectedLayout:
    """
    力导向图布局算法。

    基于优化的 Fruchterman-Reingold 算法。
    """

    def __init__(
        self,
        width: float = 1000.0,
        height: float = 1000.0,
        iterations: int = 500,
        cooling_factor: float = 0.95,
        initial_temperature: float = 0.1,
    ):
        """
        初始化布局算法。

        参数：
            width: 画布宽度
            height: 画布高度
            iterations: 最大迭代次数
            cooling_factor: 每次迭代的温度冷却因子
            initial_temperature: 初始温度（作为画布大小的分数）
        """
        self.width = width
        self.height = height
        self.iterations = iterations
        self.cooling_factor = cooling_factor
        self.initial_temperature = min(width, height) * initial_temperature

        # 力参数
        self.repulsion_constant = 5000.0
        self.attraction_constant = 0.01
        self.gravity_constant = 0.0001

    def compute(
        self,
        edges: list[tuple[int, int]],
        weights: list[float] | None = None,
        initial_positions: dict[int, Point2D] | None = None,
        fixed_nodes: set[int] | None = None,
    ) -> LayoutResult:
        """
        使用力导向算法计算布局。

        参数：
            edges: (源, 目标) 边的列表
            weights: 可选的边权重
            initial_positions: 节点的可选初始位置
            fixed_nodes: 不应移动的节点 ID 集合

        返回：
            包含最终位置的 LayoutResult
        """
        # 提取节点
        nodes = set()
        for source, target in edges:
            nodes.add(source)
            nodes.add(target)

        node_list = sorted(nodes)
        node_index = {node: i for i, node in enumerate(node_list)}
        num_nodes = len(node_list)

        if num_nodes == 0:
            return LayoutResult(positions={}, iterations=0, converged=True, final_energy=0.0)

        # 初始化位置
        if initial_positions:
            positions = [
                Point2D(
                    initial_positions[node].x if node in initial_positions else random.random() * self.width,
                    initial_positions[node].y if node in initial_positions else random.random() * self.height,
                )
                for node in node_list
            ]
        else:
            positions = [
                Point2D(random.random() * self.width, random.random() * self.height)
                for _ in range(num_nodes)
            ]

        # 构建邻接表
        adjacency = defaultdict(list)
        edge_weights = defaultdict(float)
        for i, (source, target) in enumerate(edges):
            weight = weights[i] if weights else 1.0
            adjacency[source].append(target)
            adjacency[target].append(source)
            edge_weights[(source, target)] = weight
            edge_weights[(target, source)] = weight

        fixed_indices = {node_index[node] for node in (fixed_nodes or []) if node in node_index}

        # 主循环
        temperature = self.initial_temperature
        energy = float('inf')

        for iteration in range(self.iterations):
            old_positions = [Point2D(p.x, p.y) for p in positions]

            # 计算力
            displacements = [Point2D(0.0, 0.0) for _ in range(num_nodes)]

            # Repulsion (all pairs)
            for i in range(num_nodes):
                for j in range(i + 1, num_nodes):
                    dx = positions[i].x - positions[j].x
                    dy = positions[i].y - positions[j].y
                    dist_sq = dx * dx + dy * dy
                    dist = math.sqrt(dist_sq) + 0.001  # 避免除以零

                    # 排斥力
                    force = self.repulsion_constant / dist_sq
                    fx = (dx / dist) * force
                    fy = (dy / dist) * force

                    displacements[i].x += fx
                    displacements[i].y += fy
                    displacements[j].x -= fx
                    displacements[j].y -= fy

            # Attraction (connected nodes)
            for source, targets in adjacency.items():
                i = node_index[source]
                for target in targets:
                    j = node_index[target]
                    if i >= j:
                        continue  # 每条边只处理一次

                    weight = edge_weights.get((source, target), 1.0)
                    dx = positions[i].x - positions[j].x
                    dy = positions[i].y - positions[j].y
                    dist = math.sqrt(dx * dx + dy * dy) + 0.001

                    # 吸引力（弹簧）
                    force = self.attraction_constant * dist * math.log(dist + 1) * weight
                    fx = (dx / dist) * force
                    fy = (dy / dist) * force

                    displacements[i].x -= fx
                    displacements[i].y -= fy
                    displacements[j].x += fx
                    displacements[j].y += fy

            # Gravity (pull towards center)
            center_x = self.width / 2
            center_y = self.height / 2
            for i in range(num_nodes):
                dx = center_x - positions[i].x
                dy = center_y - positions[i].y
                dist = math.sqrt(dx * dx + dy * dy) + 0.001

                force = self.gravity_constant * dist
                displacements[i].x += (dx / dist) * force
                displacements[i].y += (dy / dist) * force

            # Apply displacements with temperature limiting
            max_displacement = temperature
            for i in range(num_nodes):
                if i in fixed_indices:
                    continue

                dist = math.sqrt(displacements[i].x ** 2 + displacements[i].y ** 2)
                if dist > max_displacement:
                    scale = max_displacement / dist
                    displacements[i].x *= scale
                    displacements[i].y *= scale

                positions[i].x += displacements[i].x
                positions[i].y += displacements[i].y

                # Keep within bounds
                positions[i].x = max(0, min(self.width, positions[i].x))
                positions[i].y = max(0, min(self.height, positions[i].y))

            # Cool down
            temperature *= self.cooling_factor

            # Check convergence
            energy = sum(
                old_positions[i].distance_to(positions[i])
                for i in range(num_nodes)
            )

            if energy < 0.1 or temperature < 0.01:
                break

        # Build result
        result_positions = {
            node: positions[i]
            for node, i in node_index.items()
        }

        return LayoutResult(
            positions=result_positions,
            iterations=iteration + 1,
            converged=energy < 0.1,
            final_energy=energy,
        )


class CircularLayout:
    """
    圆形布局算法。
    将节点放置在圆周上，适合显示不连通的组件。
    """

    def __init__(self, center_x: float = 500.0, center_y: float = 500.0, radius: float = 400.0):
        """
        初始化圆形布局。

        参数：
            center_x: 中心 X 坐标
            center_y: 中心 Y 坐标
            radius: 圆半径
        """
        self.center_x = center_x
        self.center_y = center_y
        self.radius = radius

    def compute(
        self,
        nodes: list[int],
        start_angle: float = 0.0,
    ) -> LayoutResult:
        """
        计算圆形布局。

        参数：
            nodes: 节点 ID 列表
            start_angle: 起始角度（弧度）

        返回：
            包含位置的 LayoutResult
        """
        num_nodes = len(nodes)
        if num_nodes == 0:
            return LayoutResult(positions={}, iterations=1, converged=True, final_energy=0.0)

        angle_step = 2 * math.pi / num_nodes
        positions = {}

        for i, node in enumerate(nodes):
            angle = start_angle + i * angle_step
            x = self.center_x + self.radius * math.cos(angle)
            y = self.center_y + self.radius * math.sin(angle)
            positions[node] = Point2D(x, y)

        return LayoutResult(
            positions=positions,
            iterations=1,
            converged=True,
            final_energy=0.0,
        )


class GridLayout:
    """
    网格布局算法。
    将节点放置在规则网格中。
    """

    def __init__(self, width: float = 1000.0, height: float = 1000.0, padding: float = 50.0):
        """
        初始化网格布局。

        参数：
            width: 画布宽度
            height: 画布高度
            padding: 网格周围的填充
        """
        self.width = width
        self.height = height
        self.padding = padding

    def compute(
        self,
        nodes: list[int],
        columns: int | None = None,
    ) -> LayoutResult:
        """
        计算网格布局。

        参数：
            nodes: 节点 ID 列表
            columns: 列数（如果为 None 则自动计算）

        返回：
            包含位置的 LayoutResult
        """
        num_nodes = len(nodes)
        if num_nodes == 0:
            return LayoutResult(positions={}, iterations=1, converged=True, final_energy=0.0)

        if columns is None:
            columns = math.ceil(math.sqrt(num_nodes))

        rows = math.ceil(num_nodes / columns)
        cell_width = (self.width - 2 * self.padding) / max(columns - 1, 1)
        cell_height = (self.height - 2 * self.padding) / max(rows - 1, 1)

        positions = {}
        for i, node in enumerate(nodes):
            row = i // columns
            col = i % columns
            x = self.padding + col * cell_width
            y = self.padding + row * cell_height
            positions[node] = Point2D(x, y)

        return LayoutResult(
            positions=positions,
            iterations=1,
            converged=True,
            final_energy=0.0,
        )


def layout_with_igraph(
    edges: list[tuple[int, int]],
    weights: list[float] | None = None,
    width: float = 1000.0,
    height: float = 1000.0,
    algorithm: str = "fr",  # fr, kk, drl, grid
) -> LayoutResult:
    """
    使用 igraph 库计算布局（适用于大型图）。

    参数：
        edges: (源, 目标) 边的列表
        weights: 可选的边权重
        width: 画布宽度
        height: 画布高度
        algorithm: 布局算法（'fr'、'kk'、'drl'、'grid'）

    返回：
        包含位置的 LayoutResult
    """
    if not HAS_IGRAPH:
        raise ImportError("igraph is not installed. Install with: pip install python-igraph")

    # Create graph
    g = ig.Graph()
    nodes = set()
    for source, target in edges:
        nodes.add(source)
        nodes.add(target)

    g.add_vertices(list(nodes))

    if edges:
        g.add_edges(edges)

    # Compute layout
    if algorithm == "fr":
        layout = g.layout_fruchterman_reingold(
            maxiter=500,
            area=width * height,
        )
    elif algorithm == "kk":
        layout = g.layout_kamada_kawai()
    elif algorithm == "drl":
        layout = g.layout_drl()
    elif algorithm == "grid":
        layout = g.layout_grid()
    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")

    # Normalize to canvas
    min_x = min(v[0] for v in layout)
    max_x = max(v[0] for v in layout)
    min_y = min(v[1] for v in layout)
    max_y = max(v[1] for v in layout)

    positions = {}
    for i, v in enumerate(g.vs):
        x = (layout[i][0] - min_x) / (max_x - min_x + 0.001) * width
        y = (layout[i][1] - min_y) / (max_y - min_y + 0.001) * height
        positions[v["name"]] = Point2D(x, y)

    return LayoutResult(
        positions=positions,
        iterations=1,
        converged=True,
        final_energy=0.0,
    )


def layout_with_networkx(
    edges: list[tuple[int, int]],
    weights: list[float] | None = None,
    width: float = 1000.0,
    height: float = 1000.0,
    algorithm: str = "spring",  # spring, circular, shell, kamada_kawai
) -> LayoutResult:
    """
    使用 NetworkX 库计算布局。

    参数：
        edges: (源, 目标) 边的列表
        weights: 可选的边权重
        width: 画布宽度
        height: 画布高度
        algorithm: 布局算法名称

    返回：
        包含位置的 LayoutResult
    """
    if not HAS_NETWORKX:
        raise ImportError("networkx is not installed. Install with: pip install networkx")

    # Create graph
    G = nx.Graph()
    G.add_nodes_from(set(n for e in edges for n in e))

    if weights:
        weighted_edges = [(edges[i][0], edges[i][1], weights[i]) for i in range(len(edges))]
        G.add_weighted_edges_from(weighted_edges)
    else:
        G.add_edges_from(edges)

    # Compute layout
    if algorithm == "spring":
        pos = nx.spring_layout(G, dim=2, k=0.15, iterations=50)
    elif algorithm == "circular":
        pos = nx.circular_layout(G)
    elif algorithm == "shell":
        pos = nx.shell_layout(G)
    elif algorithm == "kamada_kawai":
        pos = nx.kamada_kawai_layout(G)
    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")

    # Normalize to canvas
    min_x = min(v[0] for v in pos.values())
    max_x = max(v[0] for v in pos.values())
    min_y = min(v[1] for v in pos.values())
    max_y = max(v[1] for v in pos.values())

    positions = {}
    for node, (x, y) in pos.items():
        nx = (x - min_x) / (max_x - min_x + 0.001) * width
        ny = (y - min_y) / (max_y - min_y + 0.001) * height
        positions[node] = Point2D(nx, ny)

    return LayoutResult(
        positions=positions,
        iterations=1,
        converged=True,
        final_energy=0.0,
    )


def compute_agent_layout(
    agent_ids: list[int],
    follow_edges: list[tuple[int, int]] | None = None,
    groups: dict[int, str] | None = None,
    width: float = 1000.0,
    height: float = 1000.0,
    algorithm: str = "force_directed",
) -> dict[int, tuple[float, float]]:
    """
    计算代理可视化的2D布局。

    参数：
        agent_ids: 代理 ID 列表
        follow_edges: 可选的（关注者, 被关注者）边列表
        groups: 代理的可选组分配
        width: 画布宽度
        height: 画布高度
        algorithm: 要使用的布局算法

    返回：
        将 agent_id 映射到 (x, y) 坐标的字典
    """
    if not agent_ids:
        return {}

    # Default edges (empty if not provided)
    edges = follow_edges or []

    # Choose algorithm
    if algorithm == "force_directed" and edges:
        # Use force-directed for connected graphs
        layout = ForceDirectedLayout(width=width, height=height, iterations=300)
        result = layout.compute(edges)
        positions = {aid: p.to_tuple() for aid, p in result.positions.items()}
    elif algorithm == "igraph_fr" and edges and HAS_IGRAPH:
        result = layout_with_igraph(edges, width=width, height=height, algorithm="fr")
        positions = {aid: p.to_tuple() for aid, p in result.positions.items()}
    elif algorithm == "networkx_spring" and edges and HAS_NETWORKX:
        result = layout_with_networkx(edges, width=width, height=height, algorithm="spring")
        positions = {aid: p.to_tuple() for aid, p in result.positions.items()}
    elif algorithm == "circular":
        layout = CircularLayout(center_x=width/2, center_y=height/2, radius=min(width, height)/2 * 0.9)
        result = layout.compute(agent_ids)
        positions = {aid: p.to_tuple() for aid, p in result.positions.items()}
    elif algorithm == "grid":
        layout = GridLayout(width=width, height=height)
        result = layout.compute(agent_ids)
        positions = {aid: p.to_tuple() for aid, p in result.positions.items()}
    else:
        # Default: random positions
        positions = {
            aid: (random.random() * width, random.random() * height)
            for aid in agent_ids
        }

    # Ensure all agents have positions
    for aid in agent_ids:
        if aid not in positions:
            positions[aid] = (random.random() * width, random.random() * height)

    return positions
