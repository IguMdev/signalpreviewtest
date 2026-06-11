const fs = require('fs');

const path = 'c:/Users/Igu/repos_temp/signalpreviewtest/src/routes/_authenticated/mensagens.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento nesta sala ainda.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {items.map((s) => (`;

const replaceStr = `              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento nesta sala ainda.</p>
              ) : (
                <div className="space-y-6">
                  {[...WEEKDAYS, { value: -1, label: "Sem dia definido", short: "" }].map((wd) => {
                    const dayItems = items.filter((s) => (wd.value === -1 ? (!s.weekdays || s.weekdays.length === 0) : s.weekdays?.[0] === wd.value));
                    if (dayItems.length === 0) return null;
                    return (
                      <div key={wd.value} className="space-y-3">
                        <h3 className="font-medium text-sm text-muted-foreground border-b border-border/60 pb-1 flex items-center gap-2">
                          <CalendarIcon className="size-4" /> {wd.label}
                        </h3>
                        <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-card">
                          {dayItems.map((s) => (`;

const endTargetStr = `                  ))}
                </div>
              )}`;

const endReplaceStr = `                  ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}`;

content = content.replace(targetStr, replaceStr);
content = content.replace(endTargetStr, endReplaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched mensagens.tsx successfully!');
