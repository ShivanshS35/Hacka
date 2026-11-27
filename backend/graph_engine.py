from typing import Dict, List, Any, Set

class DynamicEntityGraph:
    def __init__(self):
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []
        self._edge_set: Set[str] = set()

    def add_node(self, node_id: str, label: str, node_type: str, category: str = "GENERAL", is_hero: bool = False, channel: str = ""):
        if node_id not in self.nodes:
            self.nodes[node_id] = {
                "id": node_id,
                "label": label,
                "type": node_type,
                "category": category,
                "isHero": is_hero,
                "channels": [channel] if channel else [],
                "flaggedCount": 1
            }
        else:
            self.nodes[node_id]["flaggedCount"] += 1  # mentions across all posts
            if channel and channel not in self.nodes[node_id]["channels"]:
                self.nodes[node_id]["channels"].append(channel)
                # Same identifier in 2+ channels is the cross-channel link we surface.
                if len(self.nodes[node_id]["channels"]) >= 2:
                    self.nodes[node_id]["isHero"] = True

    def add_edge(self, source: str, target: str, label: str, category: str = "GENERAL"):
        edge_key = f"{source}-->{target}:{label}"
        if edge_key not in self._edge_set:
            self._edge_set.add(edge_key)
            self.edges.append({
                "id": f"e_{len(self.edges) + 1}",
                "source": source,
                "target": target,
                "label": label,
                "category": category
            })

    def ingest_intercept(self, post_data: Dict[str, Any]):
        post_id = post_data["id"]
        channel = post_data.get("channel", "")
        categories = post_data.get("categories") or []
        primary_cat = categories[0] if categories else "UNCLASSIFIED"
        entities = post_data.get("entities", {})

        # Add Post Node
        self.add_node(
            node_id=post_id,
            label=post_id,
            node_type="post",
            category=primary_cat,
            is_hero=False,
            channel=channel
        )

        # 1. Add UPI Nodes & Edges
        for upi in entities.get("upis", []):
            self.add_node(
                node_id=upi,
                label=upi,
                node_type="upi",
                category=primary_cat,
                is_hero=False,
                channel=channel
            )
            self.add_edge(source=post_id, target=upi, label="UPI ESCROW", category=primary_cat)

        # 2. Add Phone Nodes & Edges
        for phone in entities.get("phones", []):
            self.add_node(
                node_id=phone,
                label=phone,
                node_type="phone",
                category=primary_cat,
                is_hero=False,
                channel=channel
            )
            self.add_edge(source=post_id, target=phone, label="CALL / ORDER", category=primary_cat)

        # 3. Add Telegram Handle Nodes & Edges
        for handle in entities.get("handles", []):
            self.add_node(
                node_id=handle,
                label=handle,
                node_type="telegram",
                category=primary_cat,
                is_hero=False,
                channel=channel
            )
            self.add_edge(source=post_id, target=handle, label="CONTACT HANDLE", category=primary_cat)

        # 4. Add Crypto Wallet Nodes & Edges
        for wallet in entities.get("wallets", []):
            short_wallet = wallet[:8] + "..." + wallet[-4:] if len(wallet) > 16 else wallet
            self.add_node(
                # Keep the full address as the key so distinct wallets never merge.
                node_id=wallet,
                label=short_wallet,
                node_type="crypto",
                category=primary_cat,
                is_hero=False,
                channel=channel
            )
            self.add_edge(source=post_id, target=wallet, label="CRYPTO ESCROW", category=primary_cat)

        # Preserve the remaining extracted identifier types in the graph too.
        for bank_account in entities.get("bankAccounts", []):
            self.add_node(bank_account, bank_account, "bank_account", primary_cat, channel=channel)
            self.add_edge(post_id, bank_account, "BANK ACCOUNT MENTION", primary_cat)

        for ifsc_code in entities.get("ifscCodes", []):
            self.add_node(ifsc_code, ifsc_code, "ifsc", primary_cat, channel=channel)
            self.add_edge(post_id, ifsc_code, "IFSC CODE MENTION", primary_cat)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": list(self.nodes.values()),
            "edges": self.edges,
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges)
        }
