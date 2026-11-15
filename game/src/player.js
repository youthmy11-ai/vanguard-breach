// Player physics, smooth AABB wall/crate sliding, step-up climbing, health/armor & footsteps.
import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.4;
const KNIFE_SPEED = 6.3;
const CROUCH_SPEED = 2.6;
const GROUND_ACCEL = 44;
const AIR_ACCEL = 10;
const FRICTION = 9.5;
const GRAVITY = 20;
const JUMP_SPEED = 6.4;
const STEP_HEIGHT = 0.62;

export function createPlayer(colliders) {
  const player = {
    position: new THREE.Vector3(0, 0, 18.2),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
    hp: 100,
    armor: 0,
    alive: true,
    punchPitch: 0,
    stepDist: 0,
  };
  const probe = new THREE.Box3();
  const wish = new THREE.Vector3();

  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (let i = 0; i < colliders.length; i += 1) {
      if (probe.intersectsBox(colliders[i])) return colliders[i];
    }
    return null;
  }

  function tryMoveAxis(axis, nextVal) {
    const x = axis === 'x' ? nextVal : player.position.x;
    const z = axis === 'z' ? nextVal : player.position.z;
    const hit = overlaps(x, player.position.y, z, player.height, 0.04);
    if (!hit) {
      player.position[axis] = nextVal;
      return true;
    }
    // Smooth step-up over low crates / ramp blocks
    const stepTop = hit.max.y;
    if (player.onGround && stepTop > player.position.y && stepTop - player.position.y <= STEP_HEIGHT) {
      if (!overlaps(x, stepTop + 0.01, z, player.height, 0.04)) {
        player.position.y = stepTop;
        player.position[axis] = nextVal;
        return true;
      }
    }
    if (axis === 'x') player.velocity.x = 0;
    else player.velocity.z = 0;
    return false;
  }

  function look(dx, dy, sensitivity = 0.0021) {
    if (!player.alive) return;
    player.yaw -= dx * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    player.pitch = Math.min(1.45, player.pitch + pitchKick);
    player.yaw += yawKick;
  }

  function takeDamage(amount) {
    if (!player.alive) return { killed: false, dmg: 0 };
    let absorbed = 0;
    if (player.armor > 0) {
      absorbed = Math.min(player.armor, amount * 0.48);
      player.armor = Math.max(0, Math.round(player.armor - absorbed));
    }
    const finalDmg = Math.max(1, Math.round(amount - absorbed));
    player.hp = Math.max(0, player.hp - finalDmg);
    player.punchPitch = Math.min(0.14, player.punchPitch + 0.045);
    if (player.hp === 0) player.alive = false;
    return { killed: !player.alive, dmg: finalDmg };
  }

  function spawnAt(pos, yaw = 0) {
    player.position.copy(pos);
    player.velocity.set(0, 0, 0);
    player.yaw = yaw;
    player.pitch = 0;
    player.eye = STAND_EYE;
    player.height = STAND_HEIGHT;
    player.crouching = false;
    player.onGround = true;
    player.hp = 100;
    player.alive = true;
    player.punchPitch = 0;
    player.stepDist = 0;
  }

  function step(dt, keys, speedMult = 1, canMove = true, onStep = null) {
    player.punchPitch += (0 - player.punchPitch) * Math.min(1, dt * 12);
    if (!player.alive) return;

    const crouching = canMove && (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC'));
    if (crouching && !player.crouching) {
      player.crouching = true;
      player.height = CROUCH_HEIGHT;
    } else if (!crouching && player.crouching && !overlaps(player.position.x, player.position.y, player.position.z, STAND_HEIGHT, 0.02)) {
      player.crouching = false;
      player.height = STAND_HEIGHT;
    }
    const eyeTarget = player.crouching ? CROUCH_EYE : STAND_EYE;
    player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 13);

    const forward = canMove ? ((keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)) : 0;
    const strafe = canMove ? ((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)) : 0;
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }

    const baseSpeed = speedMult > 1.1 ? KNIFE_SPEED : (player.crouching ? CROUCH_SPEED : WALK_SPEED * speedMult);
    const blend = Math.min(1, (player.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / baseSpeed);
    player.velocity.x += (wish.x * baseSpeed - player.velocity.x) * blend;
    player.velocity.z += (wish.z * baseSpeed - player.velocity.z) * blend;
    if (player.onGround && !wish.lengthSq()) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      player.velocity.x *= damp;
      player.velocity.z *= damp;
    }

    if (canMove && keys.has('Space') && player.onGround) {
      player.velocity.y = JUMP_SPEED;
      player.onGround = false;
    }
    player.velocity.y -= GRAVITY * dt;

    tryMoveAxis('x', player.position.x + player.velocity.x * dt);
    tryMoveAxis('z', player.position.z + player.velocity.z * dt);

    player.position.y += player.velocity.y * dt;
    player.onGround = false;
    const hit = overlaps(player.position.x, player.position.y, player.position.z, player.height, 0);
    if (hit && player.velocity.y <= 0) {
      player.position.y = hit.max.y;
      player.velocity.y = 0;
      player.onGround = true;
    } else if (hit) {
      player.position.y = hit.min.y - player.height;
      player.velocity.y = 0;
    }
    if (player.position.y < 0) {
      player.position.y = 0;
      player.velocity.y = 0;
      player.onGround = true;
    }
    player.velocity.y = Math.max(-30, player.velocity.y);

    const hSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (player.onGround && hSpeed > 1.2) {
      player.stepDist += hSpeed * dt;
      if (player.stepDist >= (player.crouching ? 1.85 : 2.15)) {
        player.stepDist = 0;
        if (onStep) onStep(player.crouching);
      }
    }
  }

  return {
    state: player,
    step,
    look,
    recoil,
    takeDamage,
    spawnAt,
    groundSpeed() {
      return Math.hypot(player.velocity.x, player.velocity.z);
    },
  };
}
