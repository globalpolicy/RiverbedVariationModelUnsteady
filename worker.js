let reportCounter, timerId;
let Z0, Q, B, n, s0, porosity, a, b, reachLength, simulationTime, delX, delT, delayMs, qsInjected;

onmessage = function (ev) {
    compute(ev.data);
}


function compute(data) {

    ({ Z0, Q, B, n, s0, porosity, a, b, reachLength, simulationTime, delX, delT, delayMs, qsInjected } = data);//javascript destructuring FTW!

    let profile = {
        t: 0,
        x: [],
        z: [],
        h: [],
        q: []
    };
    let profiles = [];

    let q0 = Q / B;
    let h0 = Math.pow(q0 * q0 * n * n / s0, 0.3);

    /*initialize boundary profile*/
    profile.t = 0;
    for (let x = 0; x <= reachLength + (simulationTime / delT + 1) * delX; x += delX) {
        profile.x.push(x);
        profile.z.push(Z0 - x * s0);
        profile.h.push(h0);
        profile.q.push(q0);
    }
    profiles.push(copyObject(profile));    //push finished profile to the profiles array
    /*end initialization*/





    for (let cnt = 0; cnt <= simulationTime / delT; cnt++) {
        let currentProfile = copyObject(profiles[cnt]); //current profile is used to calculate future profiles
        clearProfile(profile);
        profile.t = (cnt + 1) * delT;

        let suggested_delT = delX / (Math.sqrt(9.81 * currentProfile.h[0]) + currentProfile.q[0] / currentProfile.h[0]);
        console.log("Suggested delT = " + suggested_delT + "\nUsing delT = " + delT);
        if (suggested_delT < delT) {
            console.log("Unstability warning @ !" + cnt * delT);
        }

        let hi_star, qi_star, zi_star, himinus1_star, qiminus1_star, ziminus1_star;
        for (let i = 0; i <= Math.trunc(reachLength / delX + simulationTime / delT + 1); i++) {
            //information simulationTime / delT * delX downstream of the downstream boundary is required for this scheme

            //predictor
            hi_star = find_hi_star(currentProfile, i);
            if (cnt > 0) {
                qi_star = find_qi_star(currentProfile, i);
            } else {
                qi_star = q0;
            }
            if (cnt > 0) {
                zi_star = find_zi_star(currentProfile, i, qi_star, hi_star);
            } else {
                zi_star = currentProfile.z[i] - 1 / (1 - porosity) * (qs(qi_star, hi_star, a, b) * hi_star / qi_star - 0) - delT / delX * 0
            }


            himinus1_star = find_himinus1_star(currentProfile, i);
            if (cnt > 0) {
                qiminus1_star = find_qiminus1_star(currentProfile, i);
            } else {
                qiminus1_star = q0;
            }
            if (cnt > 0) {
                ziminus1_star = find_ziminus1_star(currentProfile, i, qiminus1_star, himinus1_star);
            } else {
                if (i == 0) {
                    ziminus1_star = currentProfile.z[0];
                } else {
                    ziminus1_star = currentProfile.z[i - 1] - 1 / (1 - porosity) * (qs(qiminus1_star, himinus1_star, a, b) * himinus1_star / qiminus1_star - 0) - delT / delX * 0
                }
            }


            //corrector
            let hi_star2 = hi_star - delT / delX * (qi_star - qiminus1_star);
            let qi_star2;
            if (cnt > 0) {
                qi_star2 = qi_star - delT * 9.81 * i_e(qi_star, hi_star) * hi_star - delT / delX * (p(qi_star, hi_star) - p(qiminus1_star, himinus1_star) + (zi_star - ziminus1_star) * 9.81 * hi_star);
            } else {
                qi_star2 = q0;
            }
            let zi_star2 = zi_star - 1 / (1 - porosity) * (qs(qi_star2, hi_star2, a, b) * hi_star2 / qi_star2 - qs(qi_star, hi_star, a, b) * hi_star / qi_star) - delT / delX * (1 / (1 - porosity)) * (qs(qi_star, hi_star, a, b) - qs(qiminus1_star, himinus1_star, a, b));

            //averaged result
            let hi_kplus1 = (currentProfile.h[i] + hi_star2) / 2;
            let qi_kplus1 = (currentProfile.q[i] + qi_star2) / 2;
            let zi_kplus1 = (currentProfile.z[i] + zi_star2) / 2;

            //console.log(hi_kplus1, qi_kplus1, zi_kplus1);

            profile.x.push(i * delX);
            profile.q.push(qi_kplus1);
            profile.h.push(hi_kplus1);
            profile.z.push(zi_kplus1);
        }

        profiles.push(copyObject(profile));

        reportBack({ msgType: 'progress', msgData: Math.round(profiles[cnt].t / simulationTime * 100) });


    }

    console.log('Calculation finished!');

    //prune the profiles array
    for (let i = 0; i < profiles.length; i++) {
        let tmp = profiles[i];
        let usefulLength = Math.trunc(reachLength / delX + 1);
        tmp.x.length = usefulLength;
        tmp.z.length = usefulLength;
        tmp.h.length = usefulLength;
        tmp.q.length = usefulLength;
    }

    reportBack({ msgType: 'data', msgData: profiles });
}

function reportBack(dataParcel) {
    postMessage(dataParcel);
}

function copyObject(object) {
    return JSON.parse(JSON.stringify(object));
}

function p(q, h) {
    return q * q / h + 0.5 * 9.81 * h * h;
}

function qs(q, h, a, b) {
    return a * Math.pow(q / h, b);
}

function i_e(q, h) {//calculates energy slope
    return q * q * n * n / Math.pow(h, 10 / 3);
}

function find_hi_star(profile, i) {
    return profile.h[i] - delT / delX * (profile.q[i + 1] - profile.q[i]);
}

function find_qi_star(profile, i) {
    return profile.q[i] - 9.81 * profile.h[i] * i_e(profile.q[i], profile.h[i]) * delT - delT / delX * (p(profile.q[i + 1], profile.h[i + 1]) - p(profile.q[i], profile.h[i]) + 9.81 * profile.h[i] * (profile.z[i + 1] - profile.z[i]));
}

function find_zi_star(profile, i, qi_star, hi_star) {
    if (i > 0) {
        return profile.z[i] - (1 / (1 - porosity)) * (qs(qi_star, hi_star, a, b) * hi_star / qi_star - qs(profile.q[i], profile.h[i], a, b) * profile.h[i] / profile.q[i]) - delT / delX * (1 / (1 - porosity)) * (qs(profile.q[i + 1], profile.h[i + 1], a, b) - qs(profile.q[i], profile.h[i], a, b));
    } else if (i == 0) {
        return profile.z[i] - (1 / (1 - porosity)) * (qsInjected * hi_star / qi_star - qsInjected * profile.h[i] / profile.q[i]) - delT / delX * (1 / (1 - porosity)) * (qs(profile.q[i + 1], profile.h[i + 1], a, b) - qsInjected);
    }

}

function find_qiminus1_star(profile, i) {
    if (i == 0) {
        return profile.q[0];
    } else {
        return find_qi_star(profile, i - 1);
    }
}

function find_himinus1_star(profile, i) {
    if (i == 0) {
        return profile.h[0];
    } else {
        return find_hi_star(profile, i - 1);
    }
}

function find_ziminus1_star(profile, i, qiminus1_star, himinus1_star) {
    if (i == 0) {
        return profile.z[0] + delX * (profile.z[0] - profile.z[1]) / delX;
    } else {
        return find_zi_star(profile, i - 1, qiminus1_star, himinus1_star);
    }
}

function clearProfile(profile) {
    profile.x = [];
    profile.h = [];
    profile.q = [];
    profile.z = [];
}