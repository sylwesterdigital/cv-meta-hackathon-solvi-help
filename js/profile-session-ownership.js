// A newly authenticated tab owns the active browser profile. Older tabs must
// relinquish local UI state, but must NEVER delete the new owner's shared token.
// No bearer or recovery secret is exchanged via BroadcastChannel.
export function claimProfileTab(profileId, pageNonce, ChannelClass, onTakenOver) {
  if (!profileId || !ChannelClass) return null;
  const channel = new ChannelClass('solvi-active-' + profileId);
  channel.onmessage = (event) => {
    const message = event?.data;
    if (message?.type === 'CLAIM' && message.page && message.page !== pageNonce) {
      onTakenOver();
    }
  };
  channel.postMessage({type: 'CLAIM', page: pageNonce});
  return channel;
}

export function clearOnlyCurrentToken(profile, expiredToken) {
  if (!profile || !expiredToken || profile.token !== expiredToken) {
    return {profile, changed: false};
  }
  const next = {...profile};
  delete next.token;
  return {profile: next, changed: true};
}

export function requireSharedBackend(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'solvi.help' || host === 'www.solvi.help';
}
