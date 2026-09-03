# ─── CompilerJudge: C++ Execution Environment ────────────────────────
#
# Purpose:
#   This image provides a minimal, isolated Linux environment for
#   compiling and running student C++ submissions. It is intentionally
#   separate from the API server and worker — the worker will spawn
#   short-lived containers from this image to execute untrusted code.
#
# What's included:
#   - Alpine Linux (minimal footprint, ~5 MB base)
#   - g++ with full C++17 support
#   - libstdc++ for running compiled binaries
#
# What's NOT included (by design):
#   - Node.js, Python, or any runtime not needed for C++
#   - Network tools (curl, wget) — student code shouldn't phone home
#   - Package managers at runtime — the image is built once and sealed
#
# Security notes:
#   - Runs as non-root user "judge" to limit damage from malicious code
#   - No network access will be enforced at container runtime (--network=none)
#   - Memory and CPU limits will be enforced at container runtime
#   - Filesystem is ephemeral — destroyed when the container exits
#
# Usage (Phase 3A — manual testing):
#   docker build -t compilerjudge-compiler -f docker/compiler/Dockerfile .
#   docker run --rm compilerjudge-compiler g++ --version
#
# Usage (Phase 3B — worker integration):
#   The DockerExecutor will mount student code into /sandbox, compile,
#   execute, and capture stdout/stderr within time/memory limits.

FROM alpine:3.21

# Install g++ (includes C++17 support) and libstdc++
# Then clean up the package cache to keep the image small
RUN apk add --no-cache g++ libstdc++

# ── Precompile bits/stdc++.h ─────────────────────────────────────────
# bits/stdc++.h is a convenience header that includes the entire C++ STL.
# Without precompilation, g++ recompiles it from scratch every execution,
# which takes 3–5 seconds on Alpine. Precompiling it creates a .gch file
# that g++ reuses automatically, reducing compile time to < 0.5 seconds.
RUN g++ -std=c++17 -O2 \
    $(g++ -std=c++17 -x c++ -M /dev/null 2>/dev/null | head -1 || true) \
    /usr/include/c++/$(g++ -dumpversion)/bits/stdc++.h 2>/dev/null || \
    find /usr/include -name "stdc++.h" -exec g++ -std=c++17 -O2 {} \; 2>/dev/null || true

# Create a non-root user for running student code
RUN addgroup -S judge && adduser -S judge -G judge

# Create the sandbox directory where student code will be mounted
RUN mkdir -p /sandbox && chown judge:judge /sandbox

# Switch to the non-root user
USER judge

# Set the working directory to the sandbox
WORKDIR /sandbox

# Default command: drop into shell (overridden at runtime)
CMD ["/bin/sh"]

