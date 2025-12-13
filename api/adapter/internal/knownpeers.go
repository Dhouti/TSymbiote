package internal

import (
	"net/netip"
	"sync"

	"tailscale.com/ipn/ipnstate"
	"tailscale.com/types/key"
)

type KnownPeers struct {
	// map[host]IP
	peers sync.Map
	// map[IP]host
	ips sync.Map
}

func (k *KnownPeers) StorePeer(peer string, ip netip.Addr) {
	k.peers.Store(peer, ip)
	k.ips.Store(ip, peer)
}

func (k *KnownPeers) StorePeers(peers map[key.NodePublic]*ipnstate.PeerStatus) {
	// Update known hosts
	for _, peer := range peers {
		// Just skip if there isn't one.
		if len(peer.TailscaleIPs) > 0 {
			k.StorePeer(peer.HostName, peer.TailscaleIPs[0])
		}
	}
}

func (k *KnownPeers) GetIPByPeer(peer string) (netip.Addr, bool) {
	val, ok := k.peers.Load(peer)
	if !ok {
		return netip.Addr{}, false
	}
	// Nothing else could be stored here, so assert.
	return val.(netip.Addr), ok
}

func (k *KnownPeers) GetPeerByIP(ip netip.Addr) (string, bool) {
	val, ok := k.ips.Load(ip)
	if !ok {
		return "", false
	}
	// Nothing else could be stored here, so assert.
	return val.(string), ok
}
