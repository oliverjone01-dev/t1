# python3 -I link_tree.py <rev>: node_modules и закреплённые data/ (коммит 753bf11 = da0a36b по data/) в дерево scratch
import os, sys
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
for rev in sys.argv[1:]:
    t = SP + 'tree_' + rev + '/analytics-mvp/'
    for name, src in (('node_modules', SP + 'tree_753bf11/analytics-mvp/node_modules'), ('data', SP + 'data_753bf11/analytics-mvp/data')):
        if os.path.islink(t + name):
            os.unlink(t + name)
        if not os.path.exists(t + name):
            os.symlink(src, t + name)
        print(t + name, '->', os.path.realpath(t + name))
