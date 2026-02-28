const {
  createEphemeralEcdh,
  deriveSessionKey,
  signHmacSha256,
  verifyHmacSha256,
} = require("./crypto_utils");

function buildHello({ nodeId, timestamp = Math.floor(Date.now() / 1000) }) {
  const eph = createEphemeralEcdh();
  return {
    state: eph.privateEcdh,
    message: {
      type: "HELLO",
      node_id: nodeId,
      timestamp,
      ecdh_pub: eph.publicKeyB64,
      curve: eph.curve,
    },
  };
}

function handleHelloAndBuildReply({ myNodeId, helloMessage, timestamp = Math.floor(Date.now() / 1000) }) {
  if (!helloMessage || helloMessage.type !== "HELLO") {
    throw new Error("Invalid HELLO message");
  }

  const eph = createEphemeralEcdh(helloMessage.curve || "prime256v1");
  const sessionKey = deriveSessionKey({
    privateEcdh: eph.privateEcdh,
    peerPublicKeyB64: helloMessage.ecdh_pub,
  });

  const bodyToSign = {
    from: myNodeId,
    to: helloMessage.node_id,
    ts: timestamp,
    ecdh_pub: eph.publicKeyB64,
  };

  return {
    state: eph.privateEcdh,
    sessionKey,
    reply: {
      type: "HELLO_REPLY",
      node_id: myNodeId,
      peer_node_id: helloMessage.node_id,
      timestamp,
      ecdh_pub: eph.publicKeyB64,
      sig: signHmacSha256(sessionKey, bodyToSign),
    },
  };
}

function finalizeInitiator({
  myNodeId,
  helloState,
  myHello,
  reply,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  if (!reply || reply.type !== "HELLO_REPLY") {
    throw new Error("Invalid HELLO_REPLY");
  }

  const sessionKey = deriveSessionKey({
    privateEcdh: helloState,
    peerPublicKeyB64: reply.ecdh_pub,
  });

  const signedReplyBody = {
    from: reply.node_id,
    to: myHello.node_id,
    ts: reply.timestamp,
    ecdh_pub: reply.ecdh_pub,
  };

  if (!verifyHmacSha256(sessionKey, signedReplyBody, reply.sig)) {
    throw new Error("HELLO_REPLY signature invalid");
  }

  const finishedBody = {
    from: myNodeId,
    to: reply.node_id,
    ts: timestamp,
    ok: true,
  };

  return {
    sessionKey,
    finished: {
      type: "FINISHED",
      node_id: myNodeId,
      peer_node_id: reply.node_id,
      timestamp,
      ok: true,
      sig: signHmacSha256(sessionKey, finishedBody),
    },
  };
}

function verifyFinished({ sessionKey, finished }) {
  if (!finished || finished.type !== "FINISHED") {
    throw new Error("Invalid FINISHED");
  }

  const signedBody = {
    from: finished.node_id,
    to: finished.peer_node_id,
    ts: finished.timestamp,
    ok: finished.ok,
  };

  return verifyHmacSha256(sessionKey, signedBody, finished.sig);
}

module.exports = {
  buildHello,
  handleHelloAndBuildReply,
  finalizeInitiator,
  verifyFinished,
};
