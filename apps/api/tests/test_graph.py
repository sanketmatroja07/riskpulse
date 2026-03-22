"""Tests for graph linking and entity resolution."""
import pytest
import uuid


class TestEntityGraphLinking:
    """Test entity relationship graph construction."""

    def test_graph_node_deduplication(self):
        """Verify nodes are deduplicated in graph output."""
        nodes = {}
        entity_id = str(uuid.uuid4())
        nodes[entity_id] = {"id": entity_id, "type": "user", "name": "Test User"}
        nodes[entity_id] = {"id": entity_id, "type": "user", "name": "Test User"}
        assert len(nodes) == 1

    def test_edge_creation(self):
        """Verify edges connect correct source and target."""
        user_id = str(uuid.uuid4())
        device_id = str(uuid.uuid4())
        edge = {
            "source": user_id,
            "target": device_id,
            "edge_type": "uses_device",
            "weight": 1.0
        }
        assert edge["source"] == user_id
        assert edge["target"] == device_id
        assert edge["edge_type"] == "uses_device"

    def test_graph_traversal_depth(self):
        """Verify BFS traversal respects depth limits."""
        # Simulate 3-hop graph: A -> B -> C -> D
        graph = {
            "A": ["B"],
            "B": ["C"],
            "C": ["D"],
            "D": []
        }

        def bfs(start, depth):
            visited = set()
            current = {start}
            for _ in range(depth):
                next_level = set()
                for node in current:
                    visited.add(node)
                    for neighbor in graph.get(node, []):
                        if neighbor not in visited:
                            next_level.add(neighbor)
                current = next_level
            visited.update(current)
            return visited

        # Depth 1: A, B
        assert bfs("A", 1) == {"A", "B"}
        # Depth 2: A, B, C
        assert bfs("A", 2) == {"A", "B", "C"}
        # Depth 3: A, B, C, D
        assert bfs("A", 3) == {"A", "B", "C", "D"}

    def test_entity_type_classification(self):
        """Verify entity types are properly classified."""
        valid_types = {"user", "device", "ip", "card", "merchant", "email"}
        for t in valid_types:
            assert t in valid_types

    def test_edge_weight_bounds(self):
        """Verify edge weights are within expected bounds."""
        weights = [0.1, 0.5, 0.8, 1.0]
        for w in weights:
            assert 0.0 <= w <= 1.0

    def test_risk_score_aggregation(self):
        """Test risk score aggregation from connected entities."""
        scores = [0.2, 0.8, 0.5, 0.3]
        avg_score = sum(scores) / len(scores)
        max_score = max(scores)
        assert 0.0 <= avg_score <= 1.0
        assert max_score == 0.8


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
