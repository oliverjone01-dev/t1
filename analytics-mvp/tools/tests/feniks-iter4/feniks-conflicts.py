D = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad/"
L = open(D + "fx-mf-out.ts", encoding="utf-8").read().split("\n")
i = 0
k = 0
while i < len(L):
    if L[i].startswith("<<<<<<<"):
        k += 1
        j = i
        while not L[j].startswith(">>>>>>>"):
            j += 1
        print(f"=== conflict {k} lines {i+1}-{j+1}")
        for x in L[i:j+1]:
            print("   ", x[:260])
        i = j
    i += 1
# Now compare non-conflict resolution with committed result
res = open(D + "fx-bk-branch.ts", encoding="utf-8").read().split("\n")
print("committed lines", len(res), "merge-file lines", len(L))
