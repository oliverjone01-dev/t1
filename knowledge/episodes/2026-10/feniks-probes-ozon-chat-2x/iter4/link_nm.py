import os
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
dst = SP + 'tree_5c4f053/analytics-mvp/node_modules'
if not os.path.exists(dst):
    os.symlink(SP + 'tree_753bf11/analytics-mvp/node_modules', dst)
print(os.path.realpath(dst))
