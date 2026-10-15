import os
L = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/pw/node_modules"
if not os.path.lexists(L):
    os.symlink("/opt/node-tools/node_modules", L)
print(os.path.realpath(L), os.path.isdir(L + "/playwright-core"))
